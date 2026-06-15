import axios from 'axios';

const api = axios.create({
    baseURL: '/aipc-api/v1',
    timeout: 60000,
    headers: { 'Content-Type': 'application/json' },
});

// ===== Models =====
export const getModels = (params) => api.get('/models', { params });
export const getModel = (id) => api.get(`/models/${id}`);
export const createModel = (data) => api.post('/models', data);
export const updateModel = (id, data) => api.put(`/models/${id}`, data);
export const deleteModel = (id) => api.delete(`/models/${id}`);
export const toggleModel = (id) => api.patch(`/models/${id}/toggle`);
export const getModelCount = () => api.get('/models/count');

// ===== Test Suites =====
export const getTestSuites = (params) => api.get('/test-suites', { params });
export const getTestSuite = (id) => api.get(`/test-suites/${id}`);
export const createTestSuite = (data) => api.post('/test-suites', data);
export const updateTestSuite = (id, data) => api.put(`/test-suites/${id}`, data);
export const deleteTestSuite = (id) => api.delete(`/test-suites/${id}`);
export const previewTestSuite = (id, params) => api.get(`/test-suites/${id}/preview`, { params });
export const uploadTestCases = (suiteId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/test-suites/${suiteId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};
export const exportTestSuite = (suiteId, format) => api.get(`/test-suites/${suiteId}/export`, {
    params: { format },
    responseType: 'blob'
});
export const downloadTemplate = (format) => api.get('/test-suites/template/download', {
    params: { format },
    responseType: 'blob'
});
export const addTestCase = (suiteId, data) => api.post(`/test-suites/${suiteId}/cases`, data);
export const deleteTestCase = (suiteId, caseId) => api.delete(`/test-suites/${suiteId}/cases/${caseId}`);

// ===== Prompt Templates =====
export const getPromptTemplates = (params) => api.get('/prompt-templates', { params });
export const createPromptTemplate = (data) => api.post('/prompt-templates', data);
export const updatePromptTemplate = (id, data) => api.put(`/prompt-templates/${id}`, data);
export const deletePromptTemplate = (id) => api.delete(`/prompt-templates/${id}`);

// ===== Jobs =====
export const getJobs = (params) => api.get('/jobs', { params });
export const getJob = (id) => api.get(`/jobs/${id}`);
export const createJob = (data) => api.post('/jobs', data);
export const getJobProgress = (id) => api.get(`/jobs/${id}/progress`);
export const cancelJob = (id) => api.post(`/jobs/${id}/cancel`);
export const pauseJob = (id) => api.post(`/jobs/${id}/pause`);
export const resumeJob = (id) => api.post(`/jobs/${id}/resume`);
export const getJobCount = () => api.get('/jobs/count');
export const deleteJob = (id) => api.delete(`/jobs/${id}`);
export const retryFailedJob = (id) => api.post(`/jobs/${id}/retry_failed`);

// ===== Results =====
export const getAggregatedResults = (jobId) => api.get(`/jobs/${jobId}/results`);
export const recomputeAggregatedResults = (jobId) => api.post(`/jobs/${jobId}/results/recompute`);
export const getDetailedResults = (jobId, params) => api.get(`/jobs/${jobId}/results/detail`, { params });
export const getDetailedResultsCount = (jobId, params) => api.get(`/jobs/${jobId}/results/detail/count`, { params });
export const updateResult = (resultId, data) => api.patch(`/results/${resultId}`, data);
export const batchReview = (data) => api.post('/results/batch-review', data);
export const batchAIScore = (jobId, data) => api.post(`/results/batch-ai-score?job_id=${jobId}`, data);
export const getPerformanceReport = (jobId) => api.get(`/jobs/${jobId}/performance`);

// ===== Leaderboard =====
export const getLeaderboard = (params) => api.get('/leaderboard', { params });
export const getDimensions = () => api.get('/leaderboard/dimensions');

// ===== Offline Judge =====
export const getOfflineJobs = (params) => api.get('/offline-jobs', { params });
export const getOfflineJob = (id) => api.get(`/offline-jobs/${id}`);
export const getOfflineJobProgress = (id) => api.get(`/offline-jobs/${id}/progress`);
export const getOfflineJobResults = (id, params) => api.get(`/offline-jobs/${id}/results`, { params });
export const createOfflineJob = (formData) => api.post('/offline-jobs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
});
export const deleteOfflineJob = (id) => api.delete(`/offline-jobs/${id}`);
export const retryFailedOfflineJob = (id) => api.post(`/offline-jobs/${id}/retry_failed`);

// ===== Chat / Model Playground =====
export const getChatSessions = () => api.get('/chat/sessions');
export const getChatSession = (id) => api.get(`/chat/sessions/${id}`);
export const deleteChatSession = (id) => api.delete(`/chat/sessions/${id}`);
export const createChatSession = (data) => api.post('/chat/sessions', data);

export default api;
