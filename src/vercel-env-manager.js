const axios = require('axios');

class VercelEnvManager {
    constructor() {
        this.vercelToken = process.env.VERCEL_TOKEN;
        this.projectId = process.env.VERCEL_PROJECT_ID;
        this.teamId = process.env.VERCEL_TEAM_ID; // 可选，如果项目属于团队
        this.apiBase = 'https://api.vercel.com';
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
     * 获取项目的所有环境变量
     */
    async getEnvironmentVariables() {
        try {
            this.validateConfig();
            
            let url = `${this.apiBase}/v9/projects/${this.projectId}/env`;
            if (this.teamId) {
                url += `?teamId=${this.teamId}`;
            }

            const response = await axios.get(url, {
                headers: this.getHeaders()
            });

            return response.data.envs || [];
        } catch (error) {
            console.error('获取环境变量失败:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 创建或更新环境变量
     */
    async updateEnvironmentVariable(key, value, type = 'encrypted', target = ['production', 'preview']) {
        try {
            this.validateConfig();
            
            // 首先检查环境变量是否存在
            const existingVars = await this.getEnvironmentVariables();
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
                        customEnvironmentIds
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
                // 创建新环境变量
                const created = await this.createNewVar(key, value, type, target);
                return {
                    updated: false,
                    updatedCount: 0,
                    created: true,
                    results: [created]
                };
            }
        } catch (error) {
            console.error('更新环境变量失败:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 创建新环境变量
     */
    async createNewVar(key, value, type, target) {
        let url = `${this.apiBase}/v9/projects/${this.projectId}/env`;
        if (this.teamId) {
            url += `?teamId=${this.teamId}`;
        }

        const payload = {
            key,
            value,
            type,
            target
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
        });

        return response.data;
    }

    /**
     * 更新现有环境变量
     */
    async updateExistingVar(envId, key, value, type, target, customEnvironmentIds) {
        let url = `${this.apiBase}/v9/projects/${this.projectId}/env/${envId}`;
        if (this.teamId) {
            url += `?teamId=${this.teamId}`;
        }

        const payload = {
            key,
            value,
            type,
            target
        };

        if (Array.isArray(customEnvironmentIds) && customEnvironmentIds.length > 0) {
            payload.customEnvironmentIds = customEnvironmentIds;
        }

        const response = await axios.patch(url, payload, {
            headers: this.getHeaders()
        });

        return response.data;
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

            let url = `${this.apiBase}/v9/projects/${this.projectId}/env/${existingVar.id}`;
            if (this.teamId) {
                url += `?teamId=${this.teamId}`;
            }

            const response = await axios.delete(url, {
                headers: this.getHeaders()
            });

            return response.data;
        } catch (error) {
            console.error('删除环境变量失败:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 检查配置状态
     */
    getConfigStatus() {
        return {
            hasToken: !!this.vercelToken,
            hasProjectId: !!this.projectId,
            hasTeamId: !!this.teamId,
            isConfigured: !!(this.vercelToken && this.projectId)
        };
    }
}

module.exports = VercelEnvManager;
