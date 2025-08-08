const { createRepo, commitFiles, run_adhoc_sql, select_database_data, list_database_schemas, get_mot_history, scale_kubernetes_deployment, list_kubernetes_deployments } = require('./src');

// Sample test suite for chatbot functionality

describe('Chatbot Functionality Tests', () => {
    test('Create Repository', async () => {
        const response = await createRepo('test-repo', 'username', 'user', 'This is a test repository', false);
        expect(response).toEqual({ success: true, message: 'Repository created' });
    });

    test('Commit Files', async () => {
        const response = await commitFiles('session-id', 'username', 'test-repo', null, 'main');
        expect(response.success).toBe(true);
        expect(response.message).toMatch(/successfully/);
    });

    test('Execute Ad-hoc SQL Query', async () => {
        const response = await run_adhoc_sql('session-id', 'jdbc:postgresql://localhost:5432/mydb', 'SELECT * FROM users;');
        expect(response.columns).toContain('user_id');
        expect(response.data.length).toBeGreaterThan(0);
    });

    test('List Database Schemas', async () => {
        const response = await list_database_schemas('session-id', 'jdbc:postgresql://localhost:5432/mydb');
        expect(response).toContain('public');
    });

    test('Get MOT History', async () => {
        const response = await get_mot_history('ABC123');
        expect(response).toMatchObject({ registration: 'ABC123' });
    });

    test('Scale Kubernetes Deployment', async () => {
        const response = await scale_kubernetes_deployment('session-id', 'my-deployment', 'default', 3);
        expect(response.success).toBe(true);
    });

    test('List Kubernetes Deployments', async () => {
        const response = await list_kubernetes_deployments('session-id', 'default');
        expect(Array.isArray(response)).toBe(true);
    });
});