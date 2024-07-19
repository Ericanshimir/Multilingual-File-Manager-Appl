const Queue = require('bull');
const fileQueue = new Queue('file-queue', {
    redis: {
        host: '127.0.0.1',
        port: 6379
    }
});

fileQueue.process(async (job) => {
    const { file } = job.data;
    // Process the file upload here
    console.log(`Processing file: ${file}`);
    // Example: Save file to disk, perform file conversions, etc.
});

fileQueue.on('completed', (job) => {
    console.log(`Job completed with result ${job.returnvalue}`);
});

fileQueue.on('failed', (job, err) => {
    console.log(`Job failed with error ${err.message}`);
});