// producer.js
const amqplib = require('amqplib');
const log4js = require('log4js');
const logger = log4js.getLogger('Producer');

const QUEUE = 'emailsQueue';
const connectionString = 'amqp://<user>:<password>@<host>:<port>';

const sendEmailMessage = async (emailData) => {
    try {
        // Connect to RabbitMQ
        const connection = await amqplib.connect(connectionString);
        const channel = await connection.createChannel();

        // Assert the queue (make sure it exists)
        await channel.assertQueue(QUEUE, {
            durable: true,
        });

        // Send message to the queue
        channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(emailData)), {
            persistent: true, // Ensure the message is saved in case RabbitMQ crashes
        });

        console.info(`Sent message to queue: ${JSON.stringify(emailData)}`);

        // Close the connection
        await channel.close();
        await connection.close();
    } catch (error) {
        console.error('Error in sending message to RabbitMQ:', error);
    }
};

// Sample email data to send
const emailData = {
    user_id: 'user123',
    device_id: 'device456',
    activity_type: 'deploy',
    email: 'user@example.com',
    subject: 'Device Deployment',
    message: 'Your device has been successfully deployed.',
};

sendEmailMessage(emailData);
