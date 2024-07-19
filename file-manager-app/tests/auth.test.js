const request = require('supertest');
const app = require('../app');

describe('User Authentication', () => {
    it('should register a new user', async () => {
        const res = await request(app)
            .post('/register')
            .send({
                username: 'testuser',
                password: 'password'
            });
        expect(res.statusCode).toEqual(200);
        expect(res.text).toBe('User registered');
    });

    it('should login an existing user', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                username: 'testuser',
                password: 'password'
            });
        expect(res.statusCode).toEqual(302); // Assuming redirection on successful login
        expect(res.header.location).toBe('/dashboard'); // Replace with your redirect URL
    });
});
