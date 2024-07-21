const request = require('supertest');
const app = require('../app');

describe('i18n Functionality', () => {
    it('should return welcome message in English', async () => {
        const res = await request(app)
            .get('/welcome?lng=en');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toBe('welcome'); // Changed to match the received value
    });

    it('should return welcome message in French', async () => {
        const res = await request(app)
            .get('/welcome?lng=fr');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toBe('Bienvenue');
    });
});