const axios = require('axios');

class VercelEnvManager {
    constructor() {
        this.apiBase = 'https://api.vercel.com';
        this.timeout = 10000;
        this._resolvedScope = null; // { mode: 'teamId' | 'slug' | 'none', value: string }
    }

    get vercelToken() {
        return (process.env.VERCEL_TOKEN || '').trim().replace(/^['"]|['"]$/g, '');
    }

    get projectId() {
        return (process.env.VERCEL_PROJECT_ID || '').trim().replace(/^['"]|['"]$/g, '');
    }

    get teamId() {
        return (process.env.VERCEL_TEAM_ID || '').trim().replace(/^['"]|['"]$/g, '');
    }

    get deployHookUrl() {
        return (process.env.VERCEL_DEPLOY_HOOK_URL || '').trim().replace(/^['"]|['"]$/g, '');
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
     * 根据已解析或配置的 team 信息构造带查询参数的 Vercel API URL
     */
    _buildUrl(pathname, extraParams = {}, scopeOverride = undefined) {
        const url = new URL(pathname, this.apiBase);
        const scope = scopeOverride !== undefined ? scopeOverride : this._getDefaultScope();

        if (scope && scope.mode === 'teamId' && scope.value) {
            url.searchParams.set('teamId', scope.value);
        } else if (scope && scope.mode === 'slug' && scope.value) {
            url.searchParams.set('slug', scope.value);
        }

        for (const [k, v] of Object.entries(extraParams)) {
            if (v !== undefined && v !== null && v !== '') {
                url.searchParams.set(k, String(v));
            }
        }
        return url.toString();
    }

    _getDefaultScope() {
        if (this._resolvedScope) {
            return this._resolvedScope;
        }
        const rawTeam = this.teamId;
        if (!rawTeam) {
            return { mode: 'none', value: '' };
        }
        // Vercel 团队 ID 形如 team_xxx；若用户填的是团队 slug（如 xxx-projects），需用 slug 参数
        if (rawTeam.startsWith('team_')) {
            return { mode: 'teamId', value: rawTeam };
        }
        return { mode: 'slug', value: rawTeam };
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
     * 获取当前 Token 可访问的团队列表（用于 403 时自动探测正确 teamId）
     */
    async _fetchAccessibleTeams() {
        try {
            const url = this._buildUrl('/v2/teams', {}, { mode: 'none', value: '' });
            const response = await axios.get(url, {
                headers: this.getHeaders(),
                timeout: this.timeout
            });
            return Array.isArray(response.data?.teams) ? response.data.teams : [];
        } catch (error) {
            console.warn('探测 Vercel 团队列表失败:', error?.response?.status || error.message);
            return [];
        }
    }

    /**
     * 获取项目的所有环境变量（遇到 403 自动尝试无 teamId / slug / 自动探测 teamId）
     */
    async getEnvironmentVariables() {
        this.validateConfig();

        const candidateScopes = [];
        const seen = new Set();
        const pushScope = (scope) => {
            const key = `${scope.mode}:${scope.value}`;
            if (!seen.has(key)) {
                seen.add(key);
                candidateScopes.push(scope);
            }
        };

        // 1. 优先用当前默认/已缓存 scope
        pushScope(this._getDefaultScope());
        // 2. 若配置了 teamId，再尝试不带 teamId（兼容 team-scoped Token 自动隐式绑定或个人空间）
        pushScope({ mode: 'none', value: '' });
        // 3. 若配置了非 team_ 开头的值，也尝试作为 teamId 兜底
        if (this.teamId && !this.teamId.startsWith('team_')) {
            pushScope({ mode: 'teamId', value: this.teamId });
        }

        const envPath = `/v9/projects/${encodeURIComponent(this.projectId)}/env`;
        let lastError = null;

        for (const scope of candidateScopes) {
            try {
                const url = this._buildUrl(envPath, {}, scope);
                const response = await axios.get(url, {
                    headers: this.getHeaders(),
                    timeout: this.timeout
                });
                this._resolvedScope = scope;
                return response.data?.envs || [];
            } catch (error) {
                lastError = error;
                const status = error?.response?.status;
                // 仅在 403 / 404 时继续尝试其他 scope；401 等鉴权失败直接退出
                if (status !== 403 && status !== 404) {
                    break;
                }
            }
        }

        // 4. 若仍为 403 / 404，自动拉取 Token 所属团队列表逐一探测项目所在 teamId
        const lastStatus = lastError?.response?.status;
        if (lastStatus === 403 || lastStatus === 404) {
            const teams = await this._fetchAccessibleTeams();
            for (const team of teams) {
                if (!team?.id) continue;
                const scope = { mode: 'teamId', value: team.id };
                if (seen.has(`${scope.mode}:${scope.value}`)) continue;
                seen.add(`${scope.mode}:${scope.value}`);

                try {
                    const url = this._buildUrl(envPath, {}, scope);
                    const response = await axios.get(url, {
                        headers: this.getHeaders(),
                        timeout: this.timeout
                    });
                    this._resolvedScope = scope;
                    console.log(`✅ 自动匹配到项目所属 Vercel Team: ${team.id} (${team.slug || ''})`);
                    return response.data?.envs || [];
                } catch (err) {
                    lastError = err;
                }
            }

            // 给出更有针对性的排查提示（不暴露任何敏感 Token）
            const baseErr = this._formatApiError(lastError, '获取Vercel环境变量失败');
            const hint = teams.length === 0
                ? '（请检查 VERCEL_TOKEN 是否有效、是否已重新部署生效，且创建 Token 时 Scope 选为 Full Account 或该项目所属 Team）'
                : `（Token 可访问 ${teams.length} 个团队但均无权访问项目 ${this.projectId}，请核对 VERCEL_PROJECT_ID 与 Token Scope）`;
            const enhanced = new Error(`${baseErr.message} ${hint}`);
            console.error(enhanced.message);
            throw enhanced;
        }

        const formatted = this._formatApiError(lastError, '获取Vercel环境变量失败');
        console.error(formatted.message);
        throw formatted;
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
