const axios = require('axios');

class VercelEnvManager {
    constructor() {
        this.apiBase = 'https://api.vercel.com';
        this.timeout = 10000;
    }

    get vercelToken() {
        return (process.env.VERCEL_TOKEN || '').trim();
    }

    get projectId() {
        return (process.env.VERCEL_PROJECT_ID || '').trim();
    }

    get teamId() {
        return (process.env.VERCEL_TEAM_ID || '').trim();
    }

    get deployHookUrl() {
        return (process.env.VERCEL_DEPLOY_HOOK_URL || '').trim();
    }

    /**
     * 检查必需的环境变量
     */
    validateConfig() {
        if (!this.vercelToken) {
            throw new Error('VERCEL_TOKEN环境变量未设置');
        }
        if (!this.projectId) {
            throw new Error('VERCEL_PROJECT_ID环境变量未设置');
        }
        return true;
    }

    /**
     * 获取请求头
     */
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.vercelToken}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * 构造带 teamId 及附加参数的 Vercel API URL
     */
    _buildUrl(pathname, extraParams = {}) {
        const url = new URL(pathname, this.apiBase);
        if (this.teamId) {
            url.searchParams.set('teamId', this.teamId);
        }
        for (const [k, v] of Object.entries(extraParams)) {
            if (v !== undefined && v !== null && v !== '') {
                url.searchParams.set(k, String(v));
            }
        }
        return url.toString();
    }

    /**
     * 提取可读的 Vercel API 错误信息
     */
    _formatApiError(error, fallbackPrefix = 'Vercel API 请求失败') {
        const status = error?.response?.status;
        const apiErr = error?.response?.data?.error;
        const detail =
            (typeof apiErr === 'object' ? apiErr?.message : apiErr) ||
            error?.response?.data?.message ||
            error?.message ||
            '未知错误';
        return new Error(status ? `${fallbackPrefix} (HTTP ${status}): ${detail}` : `${fallbackPrefix}: ${detail}`);
    }

    /**
     * 获取项目的所有环境变量
     */
    async getEnvironmentVariables() {
        try {
            this.validateConfig();
            const url = this._buildUrl(`/v9/projects/${encodeURIComponent(this.projectId)}/env`);
            const response = await axios.get(url, {
                headers: this.getHeaders(),
                timeout: this.timeout
            });
            return response.data?.envs || [];
        } catch (error) {
            const formatted = this._formatApiError(error, '获取Vercel环境变量失败');
            console.error(formatted.message);
            throw formatted;
        }
    }

    /**
     * 创建或更新环境变量
     * @param {string} key
     * @param {string} value
     * @param {string} type
     * @param {string[]} target
     * @param {Array|null} preloadedVars 可选：已拉取的环境变量列表，避免重复请求
     */
    async updateEnvironmentVariable(key, value, type = 'encrypted', target = ['production', 'preview'], preloadedVars = null) {
        try {
            this.validateConfig();

            const existingVars = Array.isArray(preloadedVars)
                ? preloadedVars
                : await this.getEnvironmentVariables();
            const matchingVars = existingVars.filter(env => env.key === key);

            if (matchingVars.length > 0) {
                // 某些项目会为不同 target 创建多条同名变量，逐条更新避免只更新一条导致“看起来没生效”
                const results = [];
                for (const envVar of matchingVars) {
                    const envType = envVar.type || type;
                    const envTarget = Array.isArray(envVar.target) && envVar.target.length > 0
                        ? envVar.target
                        : target;
                    const customEnvironmentIds = Array.isArray(envVar.customEnvironmentIds)
                        ? envVar.customEnvironmentIds
                        : undefined;

                    const result = await this.updateExistingVar(
                        envVar.id,
                        key,
                        value,
                        envType,
                        envTarget,
                        customEnvironmentIds,
                        envVar.gitBranch
                    );
                    results.push(result);
                }

                return {
                    updated: true,
                    updatedCount: results.length,
                    created: false,
                    results
                };
            } else {
                const created = await this.createNewVar(key, value, type, target);
                return {
                    updated: false,
                    updatedCount: 0,
                    created: true,
                    results: [created]
                };
            }
        } catch (error) {
            const formatted = error.message?.startsWith('获取Vercel') || error.message?.startsWith('更新Vercel')
                ? error
                : this._formatApiError(error, `更新Vercel环境变量 ${key} 失败`);
            console.error(formatted.message);
            throw formatted;
        }
    }

    /**
     * 创建新环境变量
     */
    async createNewVar(key, value, type, target) {
        try {
            const url = this._buildUrl(`/v9/projects/${encodeURIComponent(this.projectId)}/env`);
            const payload = { key, value, type, target };
            const response = await axios.post(url, payload, {
                headers: this.getHeaders(),
                timeout: this.timeout
            });
            return response.data;
        } catch (error) {
            throw this._formatApiError(error, `创建Vercel环境变量 ${key} 失败`);
        }
    }

    /**
     * 更新现有环境变量
     */
    async updateExistingVar(envId, key, value, type, target, customEnvironmentIds, gitBranch) {
        try {
            const url = this._buildUrl(`/v9/projects/${encodeURIComponent(this.projectId)}/env/${encodeURIComponent(envId)}`);
            const payload = { key, value, type, target };

            if (Array.isArray(customEnvironmentIds) && customEnvironmentIds.length > 0) {
                payload.customEnvironmentIds = customEnvironmentIds;
            }
            if (gitBranch) {
                payload.gitBranch = gitBranch;
            }

            const response = await axios.patch(url, payload, {
                headers: this.getHeaders(),
                timeout: this.timeout
            });
            return response.data;
        } catch (error) {
            throw this._formatApiError(error, `更新Vercel环境变量 ${key} 失败`);
        }
    }

    /**
     * 删除环境变量
     */
    async deleteEnvironmentVariable(key) {
        try {
            this.validateConfig();

            const existingVars = await this.getEnvironmentVariables();
            const existingVar = existingVars.find(env => env.key === key);

            if (!existingVar) {
                throw new Error(`环境变量 ${key} 不存在`);
            }

            const url = this._buildUrl(`/v9/projects/${encodeURIComponent(this.projectId)}/env/${encodeURIComponent(existingVar.id)}`);
            const response = await axios.delete(url, {
                headers: this.getHeaders(),
                timeout: this.timeout
            });
            return response.data;
        } catch (error) {
            const formatted = this._formatApiError(error, `删除Vercel环境变量 ${key} 失败`);
            console.error(formatted.message);
            throw formatted;
        }
    }

    /**
     * 触发 Vercel 重新部署，使新环境变量在所有 Serverless 实例上生效
     * 优先使用 VERCEL_DEPLOY_HOOK_URL；否则通过 Vercel API 对最新生产部署执行 Redeploy
     */
    async triggerRedeploy(target = 'production') {
        // 方式 1：优先走 Deploy Hook（无需额外部署权限，最稳定）
        if (this.deployHookUrl) {
            try {
                const response = await axios.post(this.deployHookUrl, {}, { timeout: this.timeout });
                return {
                    triggered: true,
                    method: 'deploy-hook',
                    jobId: response.data?.job?.id || null
                };
            } catch (error) {
                throw this._formatApiError(error, 'Deploy Hook 触发重新部署失败');
            }
        }

        // 方式 2：通过 Vercel API 查找最近一次部署并触发 Redeploy
        try {
            this.validateConfig();
            const listUrl = this._buildUrl('/v6/deployments', {
                projectId: this.projectId,
                target,
                limit: 1
            });
            const listRes = await axios.get(listUrl, {
                headers: this.getHeaders(),
                timeout: this.timeout
            });
            const latest = listRes.data?.deployments?.[0];
            if (!latest || !latest.uid) {
                throw new Error(`未找到可重新部署的 ${target} 部署记录`);
            }

            const deployUrl = this._buildUrl('/v13/deployments', { forceNew: 1 });
            const deployRes = await axios.post(
                deployUrl,
                {
                    name: latest.name,
                    project: this.projectId,
                    deploymentId: latest.uid,
                    target
                },
                {
                    headers: this.getHeaders(),
                    timeout: this.timeout
                }
            );

            return {
                triggered: true,
                method: 'api',
                deploymentId: deployRes.data?.id || deployRes.data?.uid || null,
                url: deployRes.data?.url ? `https://${deployRes.data.url}` : null
            };
        } catch (error) {
            const formatted = error.message?.startsWith('未找到可重新部署')
                ? error
                : this._formatApiError(error, '触发Vercel重新部署失败');
            console.error(formatted.message);
            throw formatted;
        }
    }

    /**
     * 检查配置状态
     */
    getConfigStatus() {
        const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
        return {
            hasToken: !!this.vercelToken,
            hasProjectId: !!this.projectId,
            hasTeamId: !!this.teamId,
            hasDeployHook: !!this.deployHookUrl,
            isVercel,
            isConfigured: !!(this.vercelToken && this.projectId)
        };
    }
}

module.exports = VercelEnvManager;
