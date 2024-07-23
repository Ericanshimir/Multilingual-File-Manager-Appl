const request = require('supertest');
const app = require('../app');

describe('User Authentication', () => {
    let agent;

    beforeAll(() => {
        agent = request.agent(app);
    });

    it('should register a new user', async () => {
        const res = await agent
            .post('/register')
            .set('Accept', 'application/json')
            .send({
                username: 'testuser',
                password: 'password'
            });
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toBe('User registered successfully');
    });

    it('should login an existing user', async () => {
        const res = await agent
            .post('/login')
            .set('Accept', 'application/json')
            .send({
                username: 'testuser',
                password: 'password'
            });
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toBe('Login successful');
    });
});
