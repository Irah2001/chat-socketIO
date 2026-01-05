import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AuthService } from '../service/auth.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private rooms: string[] = ['Lobby', 'Privé A', 'Privé B', 'Privé C'];

  private logger: Logger = new Logger('ChatGateway');
  private lastMessageTimes: Map<string, number> = new Map();
  private connectedUsers: Map<string, { username: string; role: string; currentRoom: string | null }> = new Map();

  constructor(private authService: AuthService) {}

  afterInit(server: Server) {
    console.log('WebSocket server initialized');
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    const token = client.handshake.auth.token;
    const payload = this.authService.verifyToken(token);

    if (!payload) {
      this.logger.warn(`Tentative de connexion rejetée (IP: ${client.handshake.address})`);
      client.disconnect();
      return;
    }

    this.logger.log(`Client connecté: ${payload.username} (ID: ${client.id})`);

    this.connectedUsers.set(client.id, { 
        username: payload.username, 
        role: payload.role, 
        currentRoom: null 
    });

    // Envoyer la liste des salles actuelles au nouvel arrivant
    client.emit('roomList', this.rooms);

    this.joinRoomLogic(client, payload.role === 'admin' ? 'Support' : 'Lobby');
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
        this.logger.log(`Client déconnecté: ${user.username} (ID: ${client.id})`);
        if (user.currentRoom) {
            this.updateUsersInRoom(user.currentRoom);
        }
    }
    this.connectedUsers.delete(client.id);
    this.lastMessageTimes.delete(client.id);
  }

  // Typing indicator
  @SubscribeMessage('typing')
  handleTyping(@MessageBody() isTyping: boolean, @ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (!user || !user.currentRoom) return;

    client.to(user.currentRoom).emit('userTyping', { 
        username: user.username, 
        isTyping: isTyping 
    });
  }

  // Gestion des salles (admin only)
  @SubscribeMessage('createRoom')
  handleCreateRoom(@MessageBody() roomName: string, @ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);
    
    if (!user || user.role !== 'admin') {
        return;
    }

    if (!this.rooms.includes(roomName)) {
        this.rooms.push(roomName);
        this.server.emit('roomList', this.rooms); 
    }
  }

  @SubscribeMessage('deleteRoom')
  handleDeleteRoom(@MessageBody() roomName: string, @ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);

    if (!user || user.role !== 'admin') { return; }
    if (roomName === 'Lobby' || roomName === 'Support') { return; }

    this.rooms = this.rooms.filter(r => r !== roomName);
    
    this.server.in(roomName).socketsJoin('Lobby');
    this.server.in(roomName).socketsLeave(roomName);

    this.server.emit('roomList', this.rooms);
  }

  // --- LOGIQUE CHAT STANDARD ---

  @SubscribeMessage('joinRoom')
  handleJoin(@MessageBody() room: string, @ConnectedSocket() client: Socket) {
    this.joinRoomLogic(client, room);
  }

  private joinRoomLogic(client: Socket, roomName: string) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;
    if (user.currentRoom) {
        client.leave(user.currentRoom);
        this.updateUsersInRoom(user.currentRoom);
    }
    user.currentRoom = roomName;
    client.join(roomName);
    this.updateUsersInRoom(roomName);
    client.emit('joinedRoom', roomName);
  }

  // Messagerie avec anti-flood
  @SubscribeMessage('message')
  handleMessage(@MessageBody() data: { content: string }, @ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (!user || !user.currentRoom) return;

    const now = Date.now();
    const lastTime = this.lastMessageTimes.get(client.id) || 0;
    const COOLDOWN = 1000;

    if (now - lastTime < COOLDOWN) {
        client.emit('error', 'Doucement ! Attendez un peu avant de renvoyer un message.');
        return;
    }

    // Mise à jour du timestamp
    this.lastMessageTimes.set(client.id, now);

    const messagePayload = {
      sender: user.username,
      role: user.role,
      content: data.content,
      timestamp: new Date().toISOString(),
      room: user.currentRoom
    };

    this.server.to(user.currentRoom).emit('message', messagePayload);
  }

  @SubscribeMessage('changeNickname')
  handleChangeNickname(
    @MessageBody() newNickname: string,
    @ConnectedSocket() client: Socket
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    const cleanedNickname = newNickname.trim();
    if (cleanedNickname.length < 3 || cleanedNickname.length > 20) {
        client.emit('error', 'Le pseudo doit faire entre 3 et 20 caractères.');
        return;
    }

    const oldNickname = user.username;

    user.username = cleanedNickname;
    this.connectedUsers.set(client.id, user);

    client.emit('nicknameUpdated', cleanedNickname);

    if (user.currentRoom) {
        this.updateUsersInRoom(user.currentRoom);

        this.server.to(user.currentRoom).emit('message', {
            sender: 'Système',
            role: 'system',
            content: `${oldNickname} s'appelle maintenant ${cleanedNickname}`,
            timestamp: new Date().toISOString(),
            room: user.currentRoom
        });
    }
  }

  private async updateUsersInRoom(room: string) {
    const sockets = await this.server.in(room).fetchSockets();
    const users = sockets.map(s => {
        const u = this.connectedUsers.get(s.id);
        return u ? { username: u.username, role: u.role } : null;
    }).filter(u => u !== null);
    this.server.to(room).emit('users', users);
  }
}