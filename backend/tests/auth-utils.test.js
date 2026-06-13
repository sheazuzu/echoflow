const test = require('node:test');
const assert = require('node:assert/strict');

function clearModule(modulePath) {
    delete require.cache[require.resolve(modulePath)];
}

function loadMemoryUserStore() {
    const originalDriver = process.env.USER_STORE_DRIVER;
    process.env.USER_STORE_DRIVER = 'memory';

    clearModule('../utils/userStore');
    const userStore = require('../utils/userStore');
    userStore.resetMemoryStoreForTests();

    return {
        userStore,
        restore: () => {
            if (originalDriver === undefined) {
                delete process.env.USER_STORE_DRIVER;
            } else {
                process.env.USER_STORE_DRIVER = originalDriver;
            }
            clearModule('../utils/userStore');
        },
    };
}

test('userStore registers first user as system admin with default workspace', async () => {
    const { userStore, restore } = loadMemoryUserStore();

    try {
        const user = await userStore.createUser({
            name: 'Shea',
            email: 'Shea@example.com',
            password: 'password-123',
        });

        assert.equal(user.email, 'shea@example.com');
        assert.equal(user.name, 'Shea');
        assert.equal(user.isSystemAdmin, true);
        assert.equal(user.workspace.role, 'owner');
        assert.equal(user.workspace.plan, 'free');

        const authenticated = await userStore.authenticateUser('shea@example.com', 'password-123');
        assert.equal(authenticated.id, user.id);

        await assert.rejects(
            () => userStore.authenticateUser('shea@example.com', 'wrong-password'),
            /邮箱或密码不正确/
        );
    } finally {
        restore();
    }
});

test('authToken creates verifiable signed session tokens', () => {
    const originalSecret = process.env.AUTH_SESSION_SECRET;
    process.env.AUTH_SESSION_SECRET = 'test-auth-secret';

    clearModule('../config');
    clearModule('../utils/authToken');
    const authToken = require('../utils/authToken');

    try {
        const token = authToken.createSessionToken({
            id: 'user-1',
            email: 'user@example.com',
        });

        const result = authToken.verifySessionToken(token);
        assert.equal(result.valid, true);
        assert.equal(result.payload.sub, 'user-1');
        assert.equal(result.payload.email, 'user@example.com');

        const [payload, signature] = token.split('.');
        const tampered = `${payload.slice(0, -1)}x.${signature}`;
        assert.equal(authToken.verifySessionToken(tampered).valid, false);
    } finally {
        if (originalSecret === undefined) {
            delete process.env.AUTH_SESSION_SECRET;
        } else {
            process.env.AUTH_SESSION_SECRET = originalSecret;
        }
        clearModule('../config');
        clearModule('../utils/authToken');
    }
});
