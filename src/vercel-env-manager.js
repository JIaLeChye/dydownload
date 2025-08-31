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
            const existingVar = existingVars.find(env => env.key === key);

            if (existingVar) {
                // 更新现有环境变量
                return await this.updateExistingVar(existingVar.id, key, value, type, target);
            } else {
                // 创建新环境变量
                return await this.createNewVar(key, value, type, target);
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
    async updateExistingVar(envId, key, value, type, target) {
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
