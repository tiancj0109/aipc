"""Test suite management API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, Any
import json
import csv
import io
import ast

from app.database import get_db
from app.models.test_suite import TestSuite
from app.models.test_case import TestCase
from app.models.evaluation_result import EvaluationResult
from app.schemas.test_suite import TestSuiteCreate, TestSuiteUpdate, TestSuiteResponse, TestCaseResponse
from pydantic import BaseModel

class TestCaseCreateInput(BaseModel):
    prompt: str
    reference_answer: Optional[Any] = None
    metadata_: Optional[dict] = None
from app.utils.helpers import compute_hash

router = APIRouter(prefix="/test-suites", tags=["Test Suites"])


@router.get("", response_model=list[TestSuiteResponse])
def list_test_suites(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    ability_dimension: Optional[str] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取测试集列表，支持按能力维度和来源筛选。"""
    query = db.query(TestSuite)
    if ability_dimension:
        query = query.filter(TestSuite.ability_dimensions.contains(f'"{ability_dimension}"'))
    if source:
        query = query.filter(TestSuite.source == source)
    suites = query.order_by(TestSuite.created_at.desc()).offset(skip).limit(limit).all()
    if not suites:
        return suites

    suite_ids = [suite.id for suite in suites]
    count_rows = (
        db.query(TestCase.suite_id, func.count(TestCase.id))
        .filter(TestCase.suite_id.in_(suite_ids))
        .group_by(TestCase.suite_id)
        .all()
    )
    count_map = {suite_id: int(total or 0) for suite_id, total in count_rows}

    has_updates = False
    for suite in suites:
        actual_total = count_map.get(suite.id, 0)
        if suite.total_cases != actual_total:
            suite.total_cases = actual_total
            has_updates = True

    if has_updates:
        db.commit()

    return suites


@router.get("/template/download")
def download_template(
    format: str = Query("jsonl", regex="^(json|jsonl|csv)$"),
):
    """下载测试用例上传模板"""
    from fastapi.responses import Response
    
    template_data = [
        {
            "prompt": "【单选】以下哪个选项是中国首都？A.上海 B.北京 C.广州 D.深圳",
            "reference_answer": {"answer": "B"},
            "metadata": {"type": "single_choice", "category": "knowledge", "difficulty": "easy"}
        },
        {
            "prompt": "【多选】以下哪些是编程语言？A.Python B.Java C.HTML D.Rust",
            "reference_answer": {"answer": ["A", "B", "D"]},
            "metadata": {"type": "multiple_choice", "category": "coding", "difficulty": "easy"}
        },
        {
            "prompt": "【二元判定】太阳绕地球转。请回答对或错。",
            "reference_answer": {"answer": 0},
            "metadata": {"type": "binary", "category": "reasoning", "difficulty": "easy"}
        },
        {
            "prompt": "【主观】请简述你最常用的调试方法。",
            "reference_answer": {"answer": "回答应包含可执行的调试步骤与思路"},
            "metadata": {"type": "subjective", "category": "coding", "difficulty": "medium"}
        },
    ]

    if format == "json":
        content = json.dumps(template_data, ensure_ascii=False, indent=2)
        media_type = "application/json"
    elif format == "jsonl":
        lines = [json.dumps(item, ensure_ascii=False) for item in template_data]
        content = "\n".join(lines)
        media_type = "application/x-ndjson"
    else:  # csv
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["prompt", "reference_answer", "metadata"])
        writer.writeheader()
        for item in template_data:
            writer.writerow({
                "prompt": item["prompt"],
                "reference_answer": item["reference_answer"],
                "metadata": json.dumps(item["metadata"], ensure_ascii=False)
            })
        content = output.getvalue()
        media_type = "text/csv"

    return Response(content=content.encode("utf-8-sig" if format == "csv" else "utf-8"), media_type=media_type)


@router.get("/{suite_id}", response_model=TestSuiteResponse)
def get_test_suite(suite_id: int, db: Session = Depends(get_db)):
    """获取测试集详情。"""
    suite = db.query(TestSuite).filter(TestSuite.id == suite_id).first()
    if not suite:
        raise HTTPException(status_code=404, detail="测试集不存在")
    return suite


@router.post("", response_model=TestSuiteResponse, status_code=201)
def create_test_suite(data: TestSuiteCreate, db: Session = Depends(get_db)):
    """创建测试集。"""
    suite = TestSuite(**data.model_dump())
    db.add(suite)
    db.commit()
    db.refresh(suite)
    return suite


@router.put("/{suite_id}", response_model=TestSuiteResponse)
def update_test_suite(suite_id: int, data: TestSuiteUpdate, db: Session = Depends(get_db)):
    """更新测试集。"""
    suite = db.query(TestSuite).filter(TestSuite.id == suite_id).first()
    if not suite:
        raise HTTPException(status_code=404, detail="测试集不存在")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(suite, field, value)
    db.commit()
    db.refresh(suite)
    return suite


@router.delete("/{suite_id}")
def delete_test_suite(suite_id: int, db: Session = Depends(get_db)):
    """删除测试集及其所有用例和评测结果。"""
    suite = db.query(TestSuite).filter(TestSuite.id == suite_id).first()
    if not suite:
        raise HTTPException(status_code=404, detail="测试集不存在")
    
    # 提前删除依赖于 test_case 的 evaluation_result 记录，防止外键约束报错
    case_ids = db.query(TestCase.id).filter(TestCase.suite_id == suite_id).subquery()
    db.query(EvaluationResult).filter(EvaluationResult.case_id.in_(case_ids)).delete(synchronize_session=False)

    db.delete(suite)
    db.commit()
    return {"message": "测试集已删除"}


@router.get("/{suite_id}/preview")
def preview_test_suite(
    suite_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """预览测试集样本，支持分页和关键词搜索。"""
    suite = db.query(TestSuite).filter(TestSuite.id == suite_id).first()
    if not suite:
        raise HTTPException(status_code=404, detail="测试集不存在")
    
    query = db.query(TestCase).filter(TestCase.suite_id == suite_id)
    if keyword:
        query = query.filter(TestCase.prompt.contains(keyword))
        
    total = query.count()
    cases = query.order_by(TestCase.id.asc()).offset(skip).limit(limit).all()
    
    items = []
    for case in cases:
        payload = {
            "id": case.id,
            "suite_id": case.suite_id,
            "prompt": case.prompt,
            "reference_answer": case.reference_answer,
            "metadata_": case.metadata_,
            "hash": case.hash,
            "created_at": case.created_at,
        }
        items.append(TestCaseResponse.model_validate(payload).model_dump(by_alias=True))

    return {
        "items": items,
        "total": total
    }


@router.post("/{suite_id}/upload")
async def upload_test_cases(
    suite_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """上传测试用例文件（支持JSON、JSONL、CSV格式）。"""
    suite = db.query(TestSuite).filter(TestSuite.id == suite_id).first()
    if not suite:
        raise HTTPException(status_code=404, detail="测试集不存在")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("gbk")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="文件编码不支持，请使用 UTF-8 或 GBK 编码")
    cases = []

    filename = file.filename or ""
    if filename.endswith(".jsonl"):
        for line in text.strip().split("\n"):
            if line.strip():
                cases.append(json.loads(line))
    elif filename.endswith(".json"):
        data = json.loads(text)
        cases = data if isinstance(data, list) else [data]
    elif filename.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            cases.append(dict(row))
    else:
        raise HTTPException(status_code=400, detail="不支持的文件格式，请上传JSON、JSONL或CSV文件")

    added = 0
    def parse_structured_text(value: str) -> Any:
        raw = value.strip()
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            try:
                return ast.literal_eval(raw)
            except Exception:
                return None

    def parse_meta(item: dict) -> dict:
        meta = item.get("metadata", item.get("metadata_", {}))
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        if not isinstance(meta, dict):
            meta = {}
        qtype = item.get("question_type", item.get("type"))
        if qtype and "type" not in meta:
            meta["type"] = str(qtype)
        scoring_method = item.get("scoring_method")
        if scoring_method and "scoring_method" not in meta:
            meta["scoring_method"] = str(scoring_method)
        options = item.get("options")
        if options and "options" not in meta:
            if isinstance(options, str):
                try:
                    parsed = json.loads(options)
                    meta["options"] = parsed
                except Exception:
                    meta["options"] = options
            else:
                meta["options"] = options
        return meta

    def parse_reference(item: dict, meta: dict) -> dict:
        ref = item.get("reference_answer", item.get("answer", item.get("output")))
        if ref is None and item.get("correct_answer") is not None:
            ref = item.get("correct_answer")
        if ref is None and item.get("label") is not None:
            ref = item.get("label")
        if isinstance(ref, str):
            parsed_ref = parse_structured_text(ref)
            if isinstance(parsed_ref, dict):
                ref = parsed_ref
            elif isinstance(parsed_ref, list):
                ref = {"answer": parsed_ref}
            elif isinstance(parsed_ref, (str, int, float, bool)):
                ref = {"answer": parsed_ref}
            else:
                ref = {"answer": ref}
        elif isinstance(ref, list):
            ref = {"answer": ref}
        elif isinstance(ref, (int, float, bool)):
            ref = {"answer": ref}
        elif not isinstance(ref, dict):
            ref = {}

        if isinstance(ref.get("answer"), str):
            nested_answer = parse_structured_text(ref["answer"])
            if isinstance(nested_answer, dict):
                if "answer" in nested_answer:
                    ref["answer"] = nested_answer.get("answer")
                    for key, value in nested_answer.items():
                        if key != "answer" and key not in ref:
                            ref[key] = value
            elif isinstance(nested_answer, list):
                ref["answer"] = nested_answer
            elif isinstance(nested_answer, (int, float, bool)):
                ref["answer"] = nested_answer

        ref_type = ref.pop("type", None) or ref.pop("question_type", None)
        if ref_type and "type" not in meta:
            meta["type"] = str(ref_type)

        if item.get("correct_answers") is not None and "answer" not in ref:
            correct_answers = item.get("correct_answers")
            if isinstance(correct_answers, str):
                try:
                    correct_answers = json.loads(correct_answers)
                except Exception:
                    correct_answers = [v.strip() for v in correct_answers.split(",") if v.strip()]
            ref["answer"] = correct_answers

        inferred_type = str(meta.get("type", "")).lower()
        if not inferred_type and isinstance(ref.get("answer"), list):
            meta["type"] = "multiple_choice"
        return ref

    for item in cases:
        prompt = item.get("prompt", item.get("question", item.get("input", "")))
        if not prompt:
            continue
        meta = parse_meta(item)
        ref = parse_reference(item, meta)

        tc = TestCase(
            suite_id=suite_id,
            prompt=prompt,
            reference_answer=ref,
            metadata_=meta,
            hash=compute_hash(prompt),
        )
        db.add(tc)
        added += 1

    suite.total_cases = db.query(TestCase).filter(TestCase.suite_id == suite_id).count()
    db.commit()
    return {"message": f"成功导入 {added} 条测试用例", "total": suite.total_cases}


@router.get("/{suite_id}/export")
def export_test_suite(
    suite_id: int,
    format: str = Query("jsonl", regex="^(json|jsonl|csv)$"),
    db: Session = Depends(get_db),
):
    """导出测试集为指定格式文件。"""
    from fastapi.responses import Response
    suite = db.query(TestSuite).filter(TestSuite.id == suite_id).first()
    if not suite:
        raise HTTPException(status_code=404, detail="测试集不存在")

    cases = db.query(TestCase).filter(TestCase.suite_id == suite_id).all()

    def normalize_for_export(case: TestCase) -> dict:
        ref = case.reference_answer
        meta = dict(case.metadata_ or {})

        if isinstance(ref, str):
            raw = ref.strip()
            if raw:
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        ref = parsed
                    else:
                        ref = {"answer": parsed}
                except Exception:
                    ref = {"answer": raw}
            else:
                ref = {}
        elif isinstance(ref, list):
            ref = {"answer": ref}
        elif isinstance(ref, (int, float, bool)):
            ref = {"answer": ref}
        elif not isinstance(ref, dict):
            ref = {}

        ref_type = ref.pop("type", None) or ref.pop("question_type", None)
        if ref_type and "type" not in meta:
            meta["type"] = str(ref_type)

        if "type" not in meta:
            answer_value = ref.get("answer")
            if isinstance(answer_value, list):
                meta["type"] = "multiple_choice"
            else:
                meta["type"] = "subjective"

        return {
            "prompt": case.prompt,
            "reference_answer": ref,
            "metadata": meta,
        }

    if format == "json":
        data = [normalize_for_export(c) for c in cases]
        content = json.dumps(data, ensure_ascii=False, indent=2)
        media_type = "application/json"
    elif format == "jsonl":
        lines = []
        for c in cases:
            lines.append(json.dumps(normalize_for_export(c), ensure_ascii=False))
        content = "\n".join(lines)
        media_type = "application/x-ndjson"
    else:  # csv
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["prompt", "reference_answer", "metadata"])
        writer.writeheader()
        for c in cases:
            item = normalize_for_export(c)
            writer.writerow({
                "prompt": item["prompt"],
                "reference_answer": json.dumps(item["reference_answer"], ensure_ascii=False) if item["reference_answer"] else "",
                "metadata": json.dumps(item["metadata"], ensure_ascii=False) if item["metadata"] else ""
            })
        content = output.getvalue()
        media_type = "text/csv"

    return Response(content=content.encode("utf-8-sig" if format == "csv" else "utf-8"), media_type=media_type)


@router.post("/{suite_id}/cases", response_model=TestCaseResponse)
def add_test_case(suite_id: int, data: TestCaseCreateInput, db: Session = Depends(get_db)):
    """向测试集添加单个测试用例。"""
    suite = db.query(TestSuite).filter(TestSuite.id == suite_id).first()
    if not suite:
        raise HTTPException(status_code=404, detail="测试集不存在")
    
    ref = data.reference_answer
    if isinstance(ref, dict):
        parsed_ref = ref
    elif isinstance(ref, list):
        parsed_ref = {"answer": ref}
    elif isinstance(ref, (int, float, bool)):
        parsed_ref = {"answer": ref}
    elif isinstance(ref, str):
        raw = ref.strip()
        if raw:
            try:
                parsed_json = json.loads(raw)
                if isinstance(parsed_json, dict):
                    parsed_ref = parsed_json
                elif isinstance(parsed_json, list):
                    parsed_ref = {"answer": parsed_json}
                else:
                    parsed_ref = {"answer": parsed_json}
            except Exception:
                parsed_ref = {"answer": raw}
        else:
            parsed_ref = {}
    else:
        parsed_ref = {}

    meta = dict(data.metadata_) if isinstance(data.metadata_, dict) else {}
    if isinstance(parsed_ref, dict):
        ref_type = parsed_ref.pop("type", None) or parsed_ref.pop("question_type", None)
        if ref_type and "type" not in meta:
            meta["type"] = str(ref_type)
        if "type" not in meta and isinstance(parsed_ref.get("answer"), list):
            meta["type"] = "multiple_choice"

    tc = TestCase(
        suite_id=suite_id,
        prompt=data.prompt,
        reference_answer=parsed_ref,
        metadata_=meta,
        hash=compute_hash(data.prompt),
    )
    db.add(tc)
    db.flush()
    suite.total_cases = db.query(TestCase).filter(TestCase.suite_id == suite_id).count()
    db.commit()
    db.refresh(tc)
    return tc


@router.delete("/{suite_id}/cases/{case_id}")
def delete_test_case(suite_id: int, case_id: int, db: Session = Depends(get_db)):
    """从测试集中删除单个测试用例。"""
    suite = db.query(TestSuite).filter(TestSuite.id == suite_id).first()
    if not suite:
        raise HTTPException(status_code=404, detail="测试集不存在")
        
    case = db.query(TestCase).filter(TestCase.id == case_id, TestCase.suite_id == suite_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="测试用例不存在")
        
    db.query(EvaluationResult).filter(EvaluationResult.case_id == case_id).delete(synchronize_session=False)
    db.delete(case)
    
    suite.total_cases = db.query(TestCase).filter(TestCase.suite_id == suite_id).count() - 1
    db.commit()
    return {"message": "测试用例已删除"}

