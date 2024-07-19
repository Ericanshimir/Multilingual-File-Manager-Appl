const request = require('supertest');
const app = require('../app');

describe('File Management', () => {
    let agent;
    beforeAll(async () => {
        agent = request.agent(app);
        await agent
            .post('/register')
            .send({ username: 'testuser', password: 'password' });

        await agent
            .post('/login')
            .send({ username: 'testuser', password: 'password' });
    });

    it('should upload a new file', async () => {
        const res = await agent
            .post('/upload')
            .attach('file', 'tests/samplefile.txt'); // Ensure 'tests/samplefile.txt' exists
        expect(res.statusCode).toEqual(200);
        expect(res.text).toBe('File uploaded and queued for processing');
    });

    it('should get list of files', async () => {
        const res = await agent.get('/files');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toBeInstanceOf(Array);
    });

    it('should update a file', async () => {
        const res = await agent
            .put('/files/1')
            .send({ name: 'updatedfile.txt' });
        expect(res.statusCode).toEqual(200);
        expect(res.text).toBe('File updated');
    });

    it('should delete a file', async () => {
        const res = await agent.delete('/files/1');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toBe('File deleted');
    });
});
