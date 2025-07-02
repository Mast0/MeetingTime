import { startMediasoup } from "./mediasoup/mediasoup-server";
import { startSignaling } from "./signaling/signaling-server";

const run = async () => {
    await startMediasoup();
    startSignaling();
};

run();