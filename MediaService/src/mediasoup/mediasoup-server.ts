import * as mediasoup from 'mediasoup';

let worker: mediasoup.types.Worker;

export const startMediasoup = async () => {
    worker = await mediasoup.createWorker();
    console.log(`Mediasoup worker started (PID: ${worker.pid})`);

    worker.on('died', () => {
        console.error('Mediasoup worker died, exiting...');
        process.exit(1);
    });
};

export const getWorker = () => worker;