import React, { useState, useEffect, useRef } from 'react';
import {
    Layout, Menu, Input, Button, Avatar, List, Card,
    Select, Typography, Space, Tooltip, Empty, InputNumber,
    Spin, message, Badge, Popconfirm, Divider, Slider, Switch, Collapse, Drawer
} from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    SendOutlined, PlusOutlined, DeleteOutlined,
    RobotOutlined, UserOutlined, MessageOutlined,
    SettingOutlined, HistoryOutlined, ClearOutlined,
    CopyOutlined, MenuOutlined
} from '@ant-design/icons';
import {
    getChatSessions, getChatSession, deleteChatSession,
    getModels, createChatSession
} from '../api';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

const { Sider, Content } = Layout;
const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const MessageBubble = ({ msg, children, isDarkMode }) => {
    const [hover, setHover] = useState(false);

    const handleCopy = (e) => {
        e.stopPropagation();
        const textToCopy = msg.content;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                message.success('已复制');
            }, () => {
                message.error('复制失败');
            });
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = textToCopy;
            textArea.style.position = 'fixed';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    message.success('已复制');
                } else {
                    message.error('复制失败');
                }
            } catch (err) {
                message.error('复制失败');
            }
            document.body.removeChild(textArea);
        }
    };

    return (
        <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                width: 'fit-content',
                maxWidth: '100%', // Allow full width container control
                background: msg.role === 'user' ? (isDarkMode ? 'var(--primary)' : '#6C5CE7') : (isDarkMode ? '#222' : '#fff'),
                color: msg.role === 'user' ? '#fff' : 'inherit',
                padding: '12px 16px',
                borderRadius: 12,
                boxShadow: msg.role === 'assistant' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div style={{ lineHeight: 1.6, fontSize: 14 }}>
                {children}
            </div>

            {/* Action Bar inside bubble at bottom */}
            {msg.content && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: hover ? 4 : 0,
                    height: hover ? 'auto' : 0,
                    opacity: hover ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    borderTop: hover ? '1px solid rgba(255,255,255,0.1)' : 'none'
                }}>
                    <Tooltip title="复制全文">
                        <div
                            onClick={handleCopy}
                            style={{
                                cursor: 'pointer',
                                padding: '4px 8px',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                opacity: 0.8,
                                color: 'inherit'
                            }}
                            className="msg-action-btn"
                        >
                            <CopyOutlined /> 复制
                        </div>
                    </Tooltip>
                </div>
            )}
        </div>
    );
};

const CodeBlock = ({ node, inline, className, children, ...props }) => {
    const { isDarkMode } = useTheme();
    const match = /language-(\w+)/.exec(className || '');
    const codeText = String(children).replace(/\n$/, '');
    const language = match ? match[1] : 'text';

    const handleCopy = (e) => {
        e.stopPropagation(); // Prevent triggering parent copy
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(codeText).then(() => {
                message.success('已复制');
            }, () => {
                message.error('复制失败');
            });
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = codeText;
            textArea.style.position = 'fixed';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    message.success('已复制');
                } else {
                    message.error('复制失败');
                }
            } catch (err) {
                message.error('复制失败');
            }
            document.body.removeChild(textArea);
        }
    };

    return !inline && match ? (
        <div style={{
            borderRadius: '8px',
            overflow: 'hidden',
            margin: '12px 0',
            border: isDarkMode ? '1px solid #303030' : '1px solid #e0e0e0'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                background: isDarkMode ? '#2a2a2a' : '#f0f0f0',
                borderBottom: isDarkMode ? '1px solid #303030' : '1px solid #e0e0e0',
                fontSize: '12px',
                color: 'var(--text-secondary)'
            }}>
                <span style={{ fontWeight: 600 }}>{language}</span>
                <div
                    onClick={handleCopy}
                    style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        opacity: 0.8
                    }}
                    className="code-copy-btn"
                >
                    <CopyOutlined /> 复制
                </div>
            </div>
            <pre
                {...props}
                style={{
                    background: isDarkMode ? '#1a1a1a' : '#fafafa',
                    padding: '12px',
                    margin: 0,
                    overflowX: 'auto',
                }}
            >
                <code className={className} style={{ background: 'transparent', padding: 0 }}>
                    {children}
                </code>
            </pre>
            <style>{`
                .code-copy-btn:hover { opacity: 1 !important; color: var(--primary); }
            `}</style>
        </div>
    ) : (
        <code className={className} {...props}>
            {children}
        </code>
    );
};

const ModelChat = () => {
    const { isDarkMode } = useTheme();
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);

    // 内置一个默认的用户头像 (Base64 SVG) - 修复了引号缺失的问题
    const defaultUserAvatar = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNjQgNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiM2QzVDRTciLz48cGF0aCBkPSJNMzIgMTJhMTIgMTIgMCAxIDEgMCAyNCAxMiAxMiAwIDAgMSAwLTI0em0wIDI4YzExLjA0NiAwIDIwIDguOTU0IDIwIDIwdjRIMTJ2LTRjMC0xMS4wNDYgOC45NTQtMjAgMjAtMjB6IiBmaWxsPSIjZmZmIi8+PC9zdmc+";

    const [messages, setMessages] = useState([]);
    const [models, setModels] = useState([]);
    const [selectedModelId, setSelectedModelId] = useState(null);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const [maxRounds, setMaxRounds] = useState(5);
    const [collapsed, setCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [mobileSiderOpen, setMobileSiderOpen] = useState(false);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [deepThinking, setDeepThinking] = useState(false);
    const [enableTemperature, setEnableTemperature] = useState(true);
    const [temperature, setTemperature] = useState(0.7);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const shouldAutoScrollRef = useRef(true);
    const inputRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        loadModels();
        // Skip session loading from hash here, we'll handle it in the next useEffect
        // but we still need to load the list of sessions
        loadSessions();
    }, []);

    // Handle hash sync and initial loading
    useEffect(() => {
        const hashId = location.hash.replace('#', '');
        if (hashId && hashId !== String(currentSessionId)) {
            handleSelectSession(hashId);
        } else if (!hashId && currentSessionId) {
            handleNewSession();
        }
    }, [location.hash]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, chatLoading]);

    useEffect(() => {
        const selectedModel = models.find(m => String(m.id) === String(selectedModelId));
        const modelTemp = selectedModel?.default_params?.temperature;
        if (typeof modelTemp === 'number' && Number.isFinite(modelTemp)) {
            setTemperature(Math.min(2, Math.max(0, modelTemp)));
        }
    }, [models, selectedModelId]);

    const isNearBottom = () => {
        const container = messagesContainerRef.current;
        if (!container) return true;
        const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        return distanceToBottom < 80;
    };

    const scrollToBottom = (force = false) => {
        if (force || shouldAutoScrollRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: force ? 'auto' : 'smooth' });
        }
    };

    const handleMessagesScroll = () => {
        shouldAutoScrollRef.current = isNearBottom();
    };

    const loadModels = async () => {
        try {
            const res = await getModels();
            // Fix: Backend uses 'status === 1' for enabled models, not 'is_enabled'
            const activeModels = res.data.filter(m => m.status === 1);
            setModels(activeModels);

            // Fix: If current selected model is no longer in active list, clear it or pick first available
            setSelectedModelId(prevId => {
                const stillActive = activeModels.find(m => String(m.id) === String(prevId));
                if (stillActive) return stillActive.id;
                return activeModels.length > 0 ? activeModels[0].id : undefined;
            });


        } catch (e) {
            message.error('加载模型列表失败');
        }
    };

    const loadSessions = async () => {
        setLoading(true);
        try {
            const res = await getChatSessions();
            setSessions(res.data);
        } catch (e) {
            message.error('加载会话列表失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSession = async (id) => {
        if (String(id) !== String(currentSessionId)) {
            setCurrentSessionId(id);
            navigate(`#${id}`, { replace: true });
        }
        setChatLoading(true);
        try {
            const res = await getChatSession(id);
            const msgs = (res.data.messages || []).map(m => ({
                ...m,
                reasoning: m.reasoning_content || null
            }));
            setMessages(msgs);
            shouldAutoScrollRef.current = true;
            // Verify if the session model is actually enabled
            const currentModelsRes = await getModels();
            const activeModels = (currentModelsRes.data || []).filter(m => m.status === 1);
            const isModelActive = activeModels.some(m => String(m.id) === String(res.data.model_id));

            if (isModelActive) {
                setSelectedModelId(res.data.model_id);
            } else {
                message.warning('该会话使用的模型已被禁用，请更换模型');
                setSelectedModelId(activeModels.length > 0 ? activeModels[0].id : undefined);
            }
            setMaxRounds(res.data.max_rounds || 5);


        } catch (e) {
            message.error('加载会话详情失败');
        } finally {
            setChatLoading(false);
        }
    };

    const handleNewSession = () => {
        setCurrentSessionId(null);
        navigate('', { replace: true });
        setMessages([]);
        shouldAutoScrollRef.current = true;
        if (models.length > 0) setSelectedModelId(models[0].id);
    };

    const handleDeleteSession = async (id, e) => {
        e.stopPropagation();
        try {
            await deleteChatSession(id);
            message.success('已删除会话');
            if (String(currentSessionId) === String(id)) {
                handleNewSession();
            }
            loadSessions();
        } catch (e) {
            message.error('删除会话失败');
        }
    };

    const handleSend = async () => {
        const isModelValid = models.some(m => String(m.id) === String(selectedModelId));
        if (!input.trim() || chatLoading || !selectedModelId || !isModelValid) {
            if (!isModelValid && selectedModelId) message.error('请选择有效的对话模型');
            return;
        }



        const userContent = input.trim();
        setInput('');
        shouldAutoScrollRef.current = true;

        // Optimistically add user message
        const newUserMsg = { role: 'user', content: userContent };
        setMessages(prev => [...prev, newUserMsg]);
        setChatLoading(true);

        // Placeholder for assistant response
        setMessages(prev => [...prev, { role: 'assistant', content: '', id: 'streaming' }]);

        try {
            const response = await fetch('/aipc-api/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userContent,
                    model_id: selectedModelId,
                    session_id: currentSessionId,
                    max_rounds: maxRounds,
                    deep_thinking: deepThinking,
                    enable_temperature: enableTemperature,
                    ...(enableTemperature ? { temperature } : {})
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            let accumulatedReasoning = '';
            let newSessionId = currentSessionId;
            let streamBuffer = '';
            let streamStopped = false;

            const consumeEventBlock = (eventBlock) => {
                const eventLines = eventBlock.split('\n');
                const dataLines = [];
                for (const rawLine of eventLines) {
                    const line = rawLine.trim();
                    if (!line || line.startsWith(':') || line.startsWith('event:')) {
                        continue;
                    }
                    if (line.startsWith('data:')) {
                        dataLines.push(line.substring(5).trimStart());
                    } else {
                        dataLines.push(line);
                    }
                }
                if (!dataLines.length) {
                    return false;
                }
                const payload = dataLines.join('\n').trim();
                if (!payload) {
                    return false;
                }
                if (payload === '[DONE]') {
                    return true;
                }
                const data = JSON.parse(payload);
                if (data.error) {
                    throw new Error(data.error);
                }
                if (data.reasoning_content) {
                    accumulatedReasoning += data.reasoning_content;
                    setMessages(prev => {
                        const next = [...prev];
                        const lastIndex = next.length - 1;
                        next[lastIndex] = { ...next[lastIndex], reasoning: accumulatedReasoning };
                        return next;
                    });
                }
                if (data.content) {
                    accumulatedContent += data.content;
                    setMessages(prev => {
                        const next = [...prev];
                        const lastIndex = next.length - 1;
                        next[lastIndex] = { ...next[lastIndex], content: accumulatedContent };
                        return next;
                    });
                }
                if (data.session_id && !newSessionId) {
                    newSessionId = data.session_id;
                    setCurrentSessionId(newSessionId);
                    navigate(`#${newSessionId}`, { replace: true });
                }
                if (Array.isArray(data.choices) && data.choices[0]?.finish_reason === 'stop') {
                    return true;
                }
                return false;
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                streamBuffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
                const events = streamBuffer.split('\n\n');
                streamBuffer = events.pop() || '';
                for (const eventBlock of events) {
                    if (consumeEventBlock(eventBlock)) {
                        streamStopped = true;
                        break;
                    }
                }
                if (streamStopped) {
                    break;
                }
            }
            if (!streamStopped && streamBuffer.trim()) {
                consumeEventBlock(streamBuffer);
            }

            // Final update and refresh sessions
            if (!currentSessionId) loadSessions();

        } catch (e) {
            message.error(`连线失败: ${e.message}`);
            setMessages(prev => prev.filter(m => m.id !== 'streaming'));
        } finally {
            setChatLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const siderContent = (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Button
                type="primary"
                icon={<PlusOutlined />}
                block={isMobile || !collapsed}
                onClick={() => { handleNewSession(); if (isMobile) setMobileSiderOpen(false); }}
                style={{ marginBottom: 16, height: 40, borderRadius: 8 }}
            >
                {(isMobile || !collapsed) && '新建会话'}
            </Button>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                <List
                    dataSource={sessions}
                    loading={loading}
                    renderItem={item => (
                        <div
                            onClick={() => { handleSelectSession(item.id); if (isMobile) setMobileSiderOpen(false); }}
                            style={{
                                padding: '12px 16px',
                                cursor: 'pointer',
                                borderRadius: 8,
                                marginBottom: 4,
                                background: String(currentSessionId) === String(item.id) ? 'var(--primary-light)' : 'transparent',
                                color: String(currentSessionId) === String(item.id) ? 'var(--primary)' : 'var(--text-primary)',
                                display: 'flex',
                                justifyContent: (isMobile || !collapsed) ? 'space-between' : 'center',
                                alignItems: 'center',
                                transition: 'all 0.3s'
                            }}
                            className="session-item"
                        >
                            {!isMobile && collapsed ? (
                                <Tooltip title={item.title} placement="right">
                                    <MessageOutlined />
                                </Tooltip>
                            ) : (
                                <>
                                    <Space direction="vertical" size={0} style={{ overflow: 'hidden' }}>
                                        <Text strong ellipsis style={{ width: 180, color: 'inherit' }}>{item.title}</Text>
                                        <Text type="secondary" style={{ fontSize: 11 }}>{new Date(item.updated_at).toLocaleString()}</Text>
                                    </Space>
                                    <Popconfirm title="确定删除会话？" onConfirm={(e) => handleDeleteSession(item.id, e)}>
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<DeleteOutlined />}
                                            onClick={e => e.stopPropagation()}
                                            className="delete-icon"
                                        />
                                    </Popconfirm>
                                </>
                            )}
                        </div>
                    )}
                />
            </div>
        </div>
    );

    return (
        <Layout style={{ height: 'calc(100vh - 100px)', background: 'transparent', borderRadius: 12, overflow: 'hidden' }}>
            {!isMobile && (
                <Sider
                    width={280}
                    collapsible
                    collapsed={collapsed}
                    onCollapse={setCollapsed}
                    theme={isDarkMode ? 'dark' : 'light'}
                    style={{
                        borderRight: '1px solid var(--border-color)',
                        background: isDarkMode ? '#1a1a1a' : '#fff'
                    }}
                >
                    {siderContent}
                </Sider>
            )}

            <Drawer
                title="会话列表"
                placement="left"
                onClose={() => setMobileSiderOpen(false)}
                open={mobileSiderOpen}
                styles={{ body: { padding: 0 } }}
                width={280}
                style={{ background: isDarkMode ? '#1a1a1a' : '#fff' }}
            >
                {siderContent}
            </Drawer>

            <Content style={{ display: 'flex', flexDirection: 'column', background: isDarkMode ? '#141414' : '#f9f9f9', width: '100%' }}>
                {/* Chat Header */}
                <div style={{
                    padding: isMobile ? '12px 16px' : '12px 24px',
                    background: isDarkMode ? '#1a1a1a' : '#fff',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: isMobile ? '0' : '12px'
                }}>
                    {/* Top Row: Mobile menu + Model select + Settings toggle */}
                    <div style={{ display: 'flex', width: isMobile ? '100%' : 'auto', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={isMobile ? 8 : 20} wrap={!isMobile}>
                            {isMobile && (
                                <Button
                                    type="text"
                                    icon={<MenuOutlined />}
                                    onClick={() => setMobileSiderOpen(true)}
                                    style={{ padding: '0 8px', fontSize: '18px' }}
                                />
                            )}
                            <Select
                                placeholder={models.length > 0 ? "请选择对话模型" : "无可用模型"}
                                style={{ width: isMobile ? 180 : 220 }}
                                value={selectedModelId}
                                onChange={setSelectedModelId}
                                options={models.map(m => ({ label: m.name, value: m.id }))}
                                showSearch
                                optionFilterProp="label"
                                getPopupContainer={(node) => node.parentElement}
                                disabled={chatLoading || models.length === 0}
                            />
                        </Space>

                        {isMobile && (
                            <Button
                                type={showAdvancedSettings ? 'primary' : 'text'}
                                icon={<SettingOutlined />}
                                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                                size="small"
                            />
                        )}
                    </div>

                    {/* Advanced Settings Row (Hidden on mobile unless toggled) */}
                    <div style={{
                        display: (!isMobile || showAdvancedSettings) ? 'flex' : 'none',
                        width: isMobile ? '100%' : 'auto',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center',
                        gap: isMobile ? 16 : 20,
                        paddingTop: (isMobile && showAdvancedSettings) ? 16 : 0,
                        borderTop: (isMobile && showAdvancedSettings) ? '1px dashed var(--border-color)' : 'none',
                        marginTop: (isMobile && showAdvancedSettings) ? 12 : 0,
                        flex: isMobile ? 'none' : 1,
                        justifyContent: isMobile ? 'flex-start' : 'flex-end'
                    }}>
                        <div style={{ minWidth: 180, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Tooltip title="对话上下文轮数 (设为最大即为无限制)">
                                <HistoryOutlined style={{ color: 'var(--text-secondary)' }} />
                            </Tooltip>
                            <Slider
                                min={1}
                                max={100}
                                value={maxRounds}
                                onChange={setMaxRounds}
                                style={{ flex: 1 }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 45, textAlign: 'right' }}>
                                {maxRounds >= 100 ? '无限制' : `${maxRounds}轮`}
                            </span>
                        </div>
                        <div style={{ minWidth: 220, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Tooltip title="采样温度：越低越稳定，越高越发散">
                                <SettingOutlined style={{ color: 'var(--text-secondary)' }} />
                            </Tooltip>
                            <Switch
                                checked={enableTemperature}
                                onChange={setEnableTemperature}
                                disabled={chatLoading}
                                size="small"
                            />
                            <Slider
                                min={0}
                                max={2}
                                step={0.1}
                                value={temperature}
                                onChange={setTemperature}
                                style={{ flex: 1 }}
                                disabled={chatLoading || !enableTemperature}
                            />
                            <InputNumber
                                min={0}
                                max={2}
                                step={0.1}
                                precision={1}
                                value={temperature}
                                onChange={(v) => setTemperature(typeof v === 'number' ? v : 0)}
                                size="small"
                                style={{ width: 72 }}
                                disabled={chatLoading || !enableTemperature}
                            />
                        </div>
                        <Space style={{ justifyContent: isMobile ? 'space-between' : 'flex-start', marginTop: isMobile ? 4 : 0 }}>
                            <Tooltip title="启用深度思考模式（模型将更深入地分析问题）">
                                <Switch
                                    checkedChildren="深度思考"
                                    unCheckedChildren="普通"
                                    checked={deepThinking}
                                    onChange={setDeepThinking}
                                    disabled={chatLoading}
                                />
                            </Tooltip>
                            <Tooltip title="清除当前会话历史">
                                <Button icon={<ClearOutlined />} onClick={() => setMessages([])}>{isMobile ? '清空历史' : ''}</Button>
                            </Tooltip>
                        </Space>
                    </div>
                </div>

                {/* Messages Area */}
                <div
                    ref={messagesContainerRef}
                    onScroll={handleMessagesScroll}
                    style={{ flex: 1, padding: '24px', overflowY: 'auto' }}
                >
                    {messages.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Empty description="选择模型并开始一场对话吧" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        </div>
                    ) : (
                        <div style={{ maxWidth: 900, margin: '0 auto' }}>
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                        marginBottom: 24,
                                        gap: 12
                                    }}
                                >
                                    <Avatar
                                        src={msg.role === 'user' ? defaultUserAvatar : undefined}
                                        icon={msg.role === 'user' ? undefined : <RobotOutlined />}
                                        style={{ backgroundColor: msg.role === 'user' ? 'transparent' : 'var(--accent)', flexShrink: 0 }}
                                    />
                                    <div style={{ maxWidth: '80%' }}>
                                        <MessageBubble msg={msg} isDarkMode={isDarkMode}>
                                            {msg.role === 'assistant' ? (
                                                (() => {
                                                    let displayReasoning = msg.reasoning || '';
                                                    let displayContent = msg.content || '';

                                                    if (displayContent.includes('<think>')) {
                                                        const parts = displayContent.split('<think>');
                                                        displayContent = parts[0];

                                                        for (let i = 1; i < parts.length; i++) {
                                                            const block = parts[i];
                                                            const endIdx = block.indexOf('</think>');
                                                            if (endIdx !== -1) {
                                                                const reasoning = block.substring(0, endIdx).replace(/^[\r\n]+/, '');
                                                                if (reasoning) displayReasoning += (displayReasoning ? '\n\n' : '') + reasoning;
                                                                displayContent += block.substring(endIdx + 8);
                                                            } else {
                                                                // 关键优化：流式传输途中绝对不要裁减“尾部换行和空格”，否则会导致频繁的排版跳跃（卡顿感）
                                                                const reasoning = block.replace(/^[\r\n]+/, '');
                                                                if (reasoning) displayReasoning += (displayReasoning ? '\n\n' : '') + reasoning;
                                                            }
                                                        }
                                                        if (displayContent.includes('<answer>') || displayContent.includes('</answer>')) {
                                                            displayContent = displayContent.replace(/<\/?answer>/gi, '');
                                                        }
                                                    }

                                                    const isStillThinking = (msg.reasoning && !msg.content) || (msg.content && msg.content.includes('<think>') && !msg.content.includes('</think>'));

                                                    return (
                                                        <>
                                                            {displayReasoning && (
                                                                <Collapse
                                                                    size="small"
                                                                    defaultActiveKey={['1']}
                                                                    style={{ marginBottom: 8, background: isDarkMode ? '#1a1a1a' : '#f6f6f6', borderRadius: 8 }}
                                                                    items={[{
                                                                        key: '1',
                                                                        label: <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>💭 思考过程</span>,
                                                                        children: (
                                                                            <div className="markdown-body" style={{ fontSize: 13, opacity: 0.85 }}>
                                                                                <ReactMarkdown components={{ code: CodeBlock }} remarkPlugins={[remarkGfm]}>{displayReasoning}</ReactMarkdown>
                                                                            </div>
                                                                        )
                                                                    }]}
                                                                />
                                                            )}
                                                            {displayContent ? (
                                                                <div className="markdown-body">
                                                                    <ReactMarkdown components={{ code: CodeBlock }} remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
                                                                </div>
                                                            ) : (
                                                                msg.id === 'streaming' && !displayReasoning && <Spin size="small" />
                                                            )}
                                                            {msg.id === 'streaming' && displayReasoning && !displayContent && (
                                                                <div style={{ marginTop: 8 }}>
                                                                    <Spin size="small" />
                                                                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                                                                        {isStillThinking ? '正在深度思考...' : '思考完毕，正在整理回复...'}
                                                                    </Text>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()
                                            ) : (
                                                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                            )}
                                        </MessageBubble>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div style={{
                    padding: '24px',
                    background: isDarkMode ? '#1a1a1a' : '#fff',
                    borderTop: '1px solid var(--border-color)',
                }}>
                    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 12 }}>
                        <TextArea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onPressEnter={e => {
                                if (!e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="输入消息，Shift + Enter 换行..."
                            autoSize={{ minRows: 2, maxRows: 6 }}
                            autoFocus
                            style={{
                                borderRadius: 12,
                                background: isDarkMode ? '#141414' : '#f5f5f5',
                                border: 'none',
                                padding: '12px 16px'
                            }}
                        />
                        <Button
                            type="primary"
                            shape="circle"
                            icon={<SendOutlined />}
                            size="large"
                            onClick={handleSend}
                            loading={chatLoading}
                            disabled={!input.trim() || chatLoading || !selectedModelId || !models.some(m => m.id === selectedModelId)}
                            style={{ alignSelf: 'flex-end', height: 46, width: 46 }}
                        />
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            支持多轮对话 | 上下文轮数: {maxRounds >= 100 ? '无限制' : maxRounds} | 温度: {temperature.toFixed(1)} | 正在使用: {models.find(m => m.id === selectedModelId)?.name || '未选择'}
                        </Text>
                    </div>
                </div>
            </Content>

            <style>{`
                .session-item:hover {
                    background: ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'} !important;
                }
                .session-item .delete-icon {
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .session-item:hover .delete-icon {
                    opacity: 1;
                }
                .ant-layout-sider-children {
                    display: flex;
                    flex-direction: column;
                }
                .ant-layout-sider-trigger {
                    background: ${isDarkMode ? '#222' : '#f0f0f0'} !important;
                    color: ${isDarkMode ? '#eee' : '#333'} !important;
                    border-top: 1px solid var(--border-color);
                }
                .markdown-body h1, .markdown-body h2, .markdown-body h3 {
                    margin: 12px 0 6px 0;
                    font-weight: 600;
                }
                .markdown-body h1 { font-size: 1.3em; }
                .markdown-body h2 { font-size: 1.15em; }
                .markdown-body h3 { font-size: 1.05em; }
                .markdown-body p { margin: 6px 0; }
                .markdown-body ul, .markdown-body ol {
                    margin: 6px 0;
                    padding-left: 20px;
                }
                .markdown-body li { margin: 3px 0; }
                .markdown-body code {
                    background: ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 0.9em;
                }
                .markdown-body pre {
                    background: ${isDarkMode ? '#1a1a1a' : '#f4f4f4'};
                    padding: 12px;
                    border-radius: 8px;
                    overflow-x: auto;
                    margin: 8px 0;
                }
                .markdown-body pre code {
                    background: none;
                    padding: 0;
                }
                .markdown-body blockquote {
                    border-left: 3px solid var(--primary);
                    margin: 8px 0;
                    padding: 4px 12px;
                    opacity: 0.85;
                }
                .markdown-body hr {
                    border: none;
                    border-top: 1px solid var(--border-color);
                    margin: 12px 0;
                }
                .markdown-body table {
                    border-collapse: collapse;
                    margin: 8px 0;
                    width: 100%;
                }
                .markdown-body th, .markdown-body td {
                    border: 1px solid var(--border-color);
                    padding: 6px 10px;
                    font-size: 0.9em;
                }
                .markdown-body strong { font-weight: 600; }
            `}</style>
        </Layout>
    );
};

export default ModelChat;
