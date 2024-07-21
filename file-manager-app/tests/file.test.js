const request = require('supertest');
const app = require('../app');
const path = require('path');
const fs = require('fs');

describe('File Management', () => {
    let agent;
    let uploadedFileId;

    beforeAll(async () => {
        agent = request.agent(app);
        await agent
            .post('/register')
            .send({ username: 'testuser', password: 'password' });

        await agent
            .post('/login')
            .send({ username: 'testuser', password: 'password' });
    });

    afterAll(async () => {
        // Clean up any uploaded files
        if (uploadedFileId) {
            await agent.delete(`/files/${uploadedFileId}`);
        }
    });

    it('should upload a new file', async () => {
        const res = await agent
            .post('/upload')
            .attach('file', path.join(__dirname, 'samplefile.txt')); // Ensure 'tests/samplefile.txt' exists

        expect(res.statusCode).toEqual(200);
        expect(res.text).toBe('File uploaded and queued for processing');

        const files = await agent.get('/files');
        uploadedFileId = files.body[0].id; // Assuming this is the newly uploaded file
    });

    it('should get list of files', async () => {
        const res = await agent.get('/files');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toBeInstanceOf(Array);
    });

    it('should update a file', async () => {
        const res = await agent
            .put(`/files/${uploadedFileId}`)
            .send({ name: 'updatedfile.txt' });

        expect(res.statusCode).toEqual(200);
        expect(res.text).toBe(`File with ID ${uploadedFileId} updated to updatedfile.txt`);
    });

    it('should delete a file', async () => {
        const res = await agent.delete(`/files/${uploadedFileId}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toBe('File deleted');
    });
});
