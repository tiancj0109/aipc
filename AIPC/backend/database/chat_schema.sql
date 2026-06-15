-- Chat Sessions Table (对话会话表)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    title VARCHAR(255) NOT NULL COMMENT '会话标题，通常由首句消息自动生成',
    model_id INT NOT NULL COMMENT '当前对话绑定的模型ID',
    max_rounds INT DEFAULT 5 COMMENT '该会话保留的历史上下文轮数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对话会话表，记录用户与不同模型的对话历史起点';

-- Chat Messages Table (对话消息明细表)
CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    session_id INT NOT NULL COMMENT '所属会话ID',
    role VARCHAR(50) NOT NULL COMMENT '消息角色: user, assistant, system',
    content TEXT NOT NULL COMMENT '消息正文内容',
    reasoning_content TEXT DEFAULT NULL COMMENT '深度思考过程内容(仅assistant角色)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '消息发送时间',
    CONSTRAINT fk_chat_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对话消息明细表，存储每一轮对话的具体内容';

-- Index for performance (提升查询效率的索引)
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
