import {
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
    cors: true,
})
export class ClickGateway {
    @WebSocketServer()
    server: Server;

    emitClickUpdate(campaignId: string, payload: any) {
        console.log('Emitting WS event →', campaignId, payload);
        this.server.to(campaignId).emit('clickUpdate', payload);
    }

    handleConnection(client: any) {
        const token = client.handshake.query.token;

        try {
            const decoded: any = jwt.verify(
                token,
                process.env.JWT_SECRET_KEY,
            );

            client.join(decoded.campaignId);
        } catch {
            client.disconnect();
        }
    }
}
