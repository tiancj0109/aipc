"""Evaluator - scoring logic for evaluation results."""

import re
import logging
from typing import Optional
import json
import asyncio
import ast

logger = logging.getLogger(__name__)


def strip_reasoning(text: str) -> str:
    """移除模型输出中的推理/思考内容，只保留最终答案。

    覆盖格式：
    1. <think>...</think><answer>...</answer>  → 提取 <answer> 内容
    2. 多段 <think>...</think> 块             → 移除所有此类闭合块
    3. 孤立的 </think>                          → 取最后一个 </think> 之后的内容
    4. 未闭合的 <think>                         → 移除 <think> 及之后的所有内容
    5. 无任何标签                              → 原样返回
    """
    if not text:
        return text

    # 1. 优先提取 <answer>...</answer> 中的内容（兼容错别写为 <answer>...<answer> 或直接丢弃闭合标签的情况）
    answer_match = re.search(r'<answer>(.*?)(?:</?answer>|$)', text, flags=re.DOTALL | re.IGNORECASE)
    if answer_match:
        cleaned = answer_match.group(1).strip()
        # 如果提出来的仍为空，说明可能是 <answer> 紧挨着什么别的，或者直接失败，这里交给后续逻辑兜底
        if cleaned:
            logger.info("🧹 strip_reasoning: 已从 <answer> 标签中提取最终答案")
            return cleaned

    original_text = text

    # 2. 移除所有闭合的 <think>...</think> 块
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)

    # 3. 处理孤立的 </think>，取最后一个 </think> 之后的内容
    think_end_pos = text.rfind('</think>')
    if think_end_pos != -1:
        text = text[think_end_pos + len('</think>'):]

    # 4. 处理未闭合的 <think>（只取 <think> 之前的内容）
    think_start_pos = text.find('<think>')
    if think_start_pos != -1:
        text = text[:think_start_pos]

    # 5. 清理可能残留的 <answer> / </answer> 标签
    text = re.sub(r'</?answer>', '', text).strip()

    if text != original_text.strip() and text:
        logger.info("🧹 strip_reasoning: 已成功剥离推理标签并提取出最终答案")
        
    # 如果清洗后内容为空（例如模型满篇全是思考过程没有最终输出），此时返回空字符串是符合预期的，
    # 这样可以避免客观题评分器在思考过程中误匹配上选项选项。
    # 但如果为了防错也可以回退为原字符串（这里我们选择返回剔除后的真实内容，哪怕为空）
    return text if text else ""


class Evaluator:
    """Handles scoring of model outputs against reference answers."""

    async def evaluate_with_ai(
        self,
        output: str,
        reference: Optional[dict],
        prompt: str,
        judge_adapters: list,
        question_type: str = "",
    ) -> dict:
        """Score using one or more AI judge models and aggregate the results."""
        if reference is None:
            ref_text = "无"
        elif isinstance(reference, dict) and "answer" in reference and len(reference) == 1:
            ref_text = str(reference["answer"])
        else:
            ref_text = json.dumps(reference, ensure_ascii=False)
        
        q_type_str = f"\n[题目类型]\n{question_type}\n" if question_type else ""
        
        judge_prompt = f"""请作为一名客观、严谨的AI裁判，对大模型的回答进行全方位打分。

[用户原始问题]
{prompt}
{q_type_str}
[参考标准答案]
{ref_text}

[待评分的模型回答]
{output}

请根据回答的正确性、完整性、清晰度进行评分，总分10分。
你必须返回严格的JSON格式，包含以下字段：
- score: 综合得分 (0-10的数字)
- dimension_scores: 各维度得分的JSON对象，必须包含 correctness, completeness, clarity 三个键，值均为0-10。
- reason: 评分理由说明

只返回JSON格式，不要包含任何其他文字或Markdown块标记。"""

        async def call_judge(adapter) -> Optional[dict]:
            messages = [{"role": "user", "content": judge_prompt}]
            res = await adapter.chat_completion(messages, temperature=0.1, max_tokens=8192, stream=False)
            if res.error:
                return None
            try:
                # 裁判模型本身也可能是思考模型，先剥离推理内容
                content = strip_reasoning(res.content).strip()
                # 处理 markdown 代码块
                if content.startswith("```json"):
                    content = content[7:]
                    if content.endswith("```"):
                        content = content[:-3]
                elif content.startswith("```"):
                    content = content[3:]
                    if content.endswith("```"):
                        content = content[:-3]
                content = content.strip()
                # 尝试直接解析
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    pass
                # 兜底：用正则从文本中提取第一个 JSON 对象
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    return json.loads(json_match.group())
                logger.error(f"Failed to find JSON in judge output, Content: {res.content[:500]}")
                return None
            except Exception as e:
                logger.error(f"Failed to parse judge output: {e}, Content: {res.content[:500]}")
                return None

        results = await asyncio.gather(*[call_judge(a) for a in judge_adapters])
        
        valid_results: list[dict] = [r for r in results if isinstance(r, dict)]
        if not valid_results:
            return {"score": None, "metadata": {"reason": "AI裁判调用失败或解析失败"}}
            
        avg_score_val = sum(float(r.get("score", 0.0)) for r in valid_results) / len(valid_results)
        avg_score: float = float(avg_score_val)
        
        dims: dict[str, float] = {}
        for r in valid_results:
            ds = r.get("dimension_scores", {})
            if isinstance(ds, dict):
                for k, v in ds.items():
                    dims[k] = dims.get(k, 0.0) + float(v)
        
        for k in dims.keys():
            dims[k] = float(round(dims[k] / len(valid_results), 2))
            
        return {
            "score": float(round(avg_score, 2)),
            "dimension_scores": dims,
            "metadata": {
                "judges_count": len(valid_results),
                "reasons": [r.get("reason", "") for r in valid_results],
                "judge_scores": [float(r.get("score", 0.0)) for r in valid_results],
                "judge_dimension_scores": [r.get("dimension_scores", {}) for r in valid_results],
            }
        }



    def score(
        self,
        output: str,
        reference: Optional[dict] = None,
        metadata: Optional[dict] = None,
        ignore_case: bool = True,
    ) -> dict:
        """Score a model output.

        Args:
            output: Model's raw output text.
            reference: Reference answer dict (may contain 'answer', 'choices', etc.)
            metadata: Test case metadata (may contain 'type', 'scoring_method', etc.)

        Returns:
            Dict with 'score', 'metadata', and optionally 'dimension_scores'.
        """
        reference = self._normalize_reference(reference)
        if not reference:
            return {"score": None, "metadata": {"reason": "无参考答案"}}

        meta = metadata or {}
        question_type = str(meta.get("type", meta.get("question_type", ""))).lower()
        reference_type = str(reference.get("type", reference.get("question_type", ""))).lower() if isinstance(reference, dict) else ""
        if not question_type and reference_type:
            question_type = reference_type

        if question_type in ("choice", "mcq", "multiple_choice", "single_choice", "single", "select", "选择题", "单选", "单选题", "多选", "多选题"):
            return self._score_choice(output, reference, ignore_case=ignore_case)
        elif question_type in ("boolean", "true_false", "binary", "yes_no", "judge", "判断题", "二元判定", "对错", "是非题"):
            return self._score_boolean(output, reference, ignore_case=ignore_case)
        elif question_type in ("code", "coding"):
            return self._score_code(output, reference)
        elif question_type in ("contains", "包含"):
            return self._score_contains(output, reference)
        elif self._looks_like_choice_reference(reference):
            return self._score_choice(output, reference, ignore_case=ignore_case)
        elif self._looks_like_boolean_reference(reference):
            return self._score_boolean(output, reference, ignore_case=ignore_case)
        else:
            return {"score": None, "metadata": {"reason": "主观题或未知题型，已跳过自动打分"}}

    def _score_choice(self, output: str, reference: dict, ignore_case: bool = True) -> dict:
        correct_set = self._normalize_choice_answers(reference.get("answer"), ignore_case=ignore_case)
        if not correct_set:
            return {"score": None, "metadata": {"reason": "选择题参考答案为空"}}
        is_single_choice = len(correct_set) == 1
        if is_single_choice:
            model_answer = self._extract_single_choice_answer(output, ignore_case=ignore_case)
            model_set = {model_answer} if model_answer else set()
        else:
            model_set = self._extract_choice_answers(output, ignore_case=ignore_case)
        if not model_set:
            return {
                "score": 0.0,
                "metadata": {
                    "reason": "未识别到有效选项，判定为错误",
                    "correct_answer": sorted(correct_set),
                    "model_answer": [],
                    "match": False,
                },
            }
        is_correct = model_set == correct_set
        return {
            "score": 1.0 if is_correct else 0.0,
            "metadata": {
                "reason": "模型答案与标准答案一致" if is_correct else "模型答案与标准答案不一致",
                "correct_answer": sorted(correct_set),
                "model_answer": sorted(model_set),
                "match": is_correct,
            },
        }

    def _score_boolean(self, output: str, reference: dict, ignore_case: bool = True) -> dict:
        true_variants = {"true", "yes", "correct", "是", "对", "正确", "t"}
        false_variants = {"false", "no", "incorrect", "否", "错", "错误", "f"}
        correct_raw = reference.get("answer")
        correct_bool = self._normalize_boolean_answer(correct_raw, true_variants, false_variants, ignore_case=ignore_case)
        model_answer = self._normalize_boolean_answer(output, true_variants, false_variants, ignore_case=ignore_case)
        if correct_bool is None:
            return {"score": None, "metadata": {"reason": "二元判定参考答案非法"}}
        is_correct = model_answer == correct_bool

        return {
            "score": 1.0 if is_correct else 0.0,
            "metadata": {
                "reason": "模型判断与标准答案一致" if is_correct else "模型判断与标准答案不一致",
                "correct_answer": correct_bool,
                "model_answer": model_answer,
                "match": is_correct,
            },
        }

    def _score_exact(self, output: str, reference: dict) -> dict:
        """Score by exact match."""
        correct = str(reference.get("answer", "")).strip()
        model_answer = output.strip()
        is_correct = model_answer == correct
        return {
            "score": 1.0 if is_correct else 0.0,
            "metadata": {"match": is_correct},
        }

    def _score_contains(self, output: str, reference: dict) -> dict:
        """Score by checking if output contains the reference answer."""
        correct = str(reference.get("answer", "")).strip()
        if not correct:
            return {"score": None, "metadata": {"reason": "参考答案为空"}}
        contains = correct.lower() in output.lower()
        return {
            "score": 1.0 if contains else 0.0,
            "metadata": {
                "expected": correct,
                "contains": contains,
            },
        }

    def _score_code(self, output: str, reference: dict) -> dict:
        """Score code output (basic comparison, full sandbox TBD)."""
        expected = str(reference.get("answer", reference.get("test_code", "")))
        if not expected:
            return {"score": None, "metadata": {"reason": "无参考代码"}}

        # Basic: check if key parts are present
        output_clean = re.sub(r'\s+', ' ', output.strip())
        expected_clean = re.sub(r'\s+', ' ', expected.strip())

        if output_clean == expected_clean:
            return {"score": 1.0, "metadata": {"match": "exact"}}
        elif expected_clean in output_clean:
            return {"score": 0.8, "metadata": {"match": "contains"}}
        else:
            return {"score": 0.0, "metadata": {"match": "none"}}

    def _extract_choice_answers(self, output: str, ignore_case: bool = True) -> set[str]:
        if output is None:
            return set()
        output_text = str(output).strip()
        if not output_text:
            return set()
        letter_matches = re.findall(r'\b([A-Za-z])\b', output_text)
        if letter_matches:
            return {m.upper() if ignore_case else m for m in letter_matches}
        parts = [p.strip() for p in re.split(r'[,，/;；、\s]+', output_text) if p and p.strip()]
        if len(parts) > 1:
            return {p.lower() if ignore_case else p for p in parts}
        compact_alpha = re.sub(r'[^A-Za-z]', '', output_text)
        if compact_alpha:
            compact_upper = compact_alpha.upper()
            if 1 < len(compact_upper) <= 6:
                return set(list(compact_upper))
        return {output_text.lower() if ignore_case else output_text}

    def _extract_single_choice_answer(self, output: str, ignore_case: bool = True) -> Optional[str]:
        if output is None:
            return None
        text = str(output).strip()
        if not text:
            return None
            
        # Optional: strip common markdown blocks
        if text.startswith("```json"):
            text = text[7:]
            if text.endswith("```"): text = text[:-3]
        elif text.startswith("```"):
            text = text[3:]
            if text.endswith("```"): text = text[:-3]
        text = text.strip()

        cue_patterns = [
            r'(?i)(?:最终答案|答案|选择|选项|answer|option)\s*[:：是为]?\s*[\(\[（]?\s*([A-Za-z])\b',
            r'(?i)"answer"\s*[:=]\s*"([A-Za-z])"',
            r"(?i)'answer'\s*[:=]\s*'([A-Za-z])'",
        ]
        for pattern in cue_patterns:
            matches = re.findall(pattern, text)
            if matches:
                value = matches[-1]
                return value.upper() if ignore_case else value
        stripped = text.strip()
        exact_match = re.fullmatch(r'[\(\[（]?\s*([A-Za-z])\s*[\)\]）]?[。.!！?？,，;；:\s]*', stripped)
        if exact_match:
            value = exact_match.group(1)
            return value.upper() if ignore_case else value
        letter_matches = re.findall(r'\b([A-Za-z])\b', text)
        if letter_matches:
            value = letter_matches[-1]
            return value.upper() if ignore_case else value
        return None

    def _normalize_choice_answers(self, answer, ignore_case: bool = True) -> set[str]:
        if answer is None:
            return set()
        if isinstance(answer, list):
            normalized = set()
            for v in answer:
                token = self._sanitize_choice_token(v)
                if not token:
                    continue
                if re.fullmatch(r'[A-Za-z]', token):
                    normalized.add(token.upper() if ignore_case else token)
                else:
                    normalized.add(token.lower() if ignore_case else token)
            return normalized
        if isinstance(answer, tuple):
            normalized = set()
            for v in answer:
                token = self._sanitize_choice_token(v)
                if not token:
                    continue
                if re.fullmatch(r'[A-Za-z]', token):
                    normalized.add(token.upper() if ignore_case else token)
                else:
                    normalized.add(token.lower() if ignore_case else token)
            return normalized
        answer_str = self._sanitize_choice_token(answer)
        if not answer_str:
            return set()
        parts = re.split(r'[,，/;；\s]+', answer_str)
        filtered = [p for p in parts if p]
        if len(filtered) > 1:
            normalized = set()
            for p in filtered:
                token = self._sanitize_choice_token(p)
                if re.fullmatch(r'[A-Za-z]', token):
                    normalized.add(token.upper() if ignore_case else token)
                else:
                    normalized.add(token.lower() if ignore_case else token)
            return normalized
        answer_alpha = re.sub(r'[^A-Za-z]', '', answer_str)
        if answer_alpha:
            answer_alpha_upper = answer_alpha.upper()
            if 1 < len(answer_alpha_upper) <= 6:
                return set(list(answer_alpha_upper))
        if re.fullmatch(r'[A-Za-z]', answer_str):
            return {answer_str.upper() if ignore_case else answer_str}
        return {answer_str.lower() if ignore_case else answer_str}

    def _normalize_boolean_answer(self, value, true_variants: set[str], false_variants: set[str], ignore_case: bool = True) -> Optional[str]:
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            if value == 1:
                return "true"
            if value == 0:
                return "false"
        text = str(value).strip().lower() if ignore_case else str(value).strip()
        if text in {"1"}:
            return "true"
        if text in {"0"}:
            return "false"
        if text in true_variants:
            return "true"
        if text in false_variants:
            return "false"
        tokens = re.findall(r'[a-zA-Z\u4e00-\u9fa5]+', text)
        for token in tokens:
            if token in true_variants:
                return "true"
            if token in false_variants:
                return "false"
        return None

    def _looks_like_choice_reference(self, reference: dict) -> bool:
        answer = reference.get("answer")
        if isinstance(answer, list):
            return True
        if isinstance(answer, str):
            answer_str = answer.strip().upper()
            return bool(re.fullmatch(r'[A-Z](\s*[,，/;；]\s*[A-Z])+', answer_str) or re.fullmatch(r'[A-Z]{1,6}', answer_str))
        return False

    def _looks_like_boolean_reference(self, reference: dict) -> bool:
        answer = reference.get("answer")
        if isinstance(answer, bool):
            return True
        text = str(answer).strip().lower()
        return text in {"true", "false", "yes", "no", "是", "否", "对", "错", "1", "0"}

    def _parse_reference_text(self, reference_text: str) -> Optional[dict]:
        text = reference_text.strip()
        if not text:
            return None
        if text.startswith("{") and text.endswith("}"):
            try:
                loaded = json.loads(text)
                if isinstance(loaded, dict):
                    return loaded
            except Exception:
                pass
            try:
                loaded = ast.literal_eval(text)
                if isinstance(loaded, dict):
                    return loaded
            except Exception:
                pass
        return None

    def _normalize_reference(self, reference):
        if isinstance(reference, dict):
            return reference
        if isinstance(reference, str):
            parsed_reference = self._parse_reference_text(reference)
            if parsed_reference is not None:
                return parsed_reference
            text = reference.strip()
            if not text:
                return None
            return {"answer": self._sanitize_choice_token(text)}
        if reference is None:
            return None
        return {"answer": reference}

    def _sanitize_choice_token(self, value) -> str:
        text = str(value).strip()
        if not text:
            return ""
        text = text.strip("\"'“”‘’`")
        text = text.strip()
        text = re.sub(r'^(?:answer|答案)\s*[:：=]\s*', '', text, flags=re.IGNORECASE)
        text = text.strip("\"'“”‘’`")
        text = text.strip()
        return text
