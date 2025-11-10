// // src/client/websocket-client.ts
// // import { io, Socket } from 'socket.io-client';

// import { Socket } from "dgram";

// export class ChatClient {
//   private socket: Socket;
//   private token: string;

//   constructor(apiUrl: string, token: string) {
//     this.token = token;
//     this.socket = io(apiUrl, {
//       auth: {
//         token: token
//       },
//       transports: ['websocket', 'polling'], // Fallback options
//       timeout: 10000, // 10 seconds timeout
//       reconnection: true,
//       reconnectionAttempts: 5,
//       reconnectionDelay: 1000,
//     });

//     this.setupEventListeners();
//   }

//   private setupEventListeners(): void {
//     // Connection events
//     this.socket.on('connect', () => {
//       console.log('Connected to chat server');
//       this.handleConnected();
//     });

//     this.socket.on('connect_error', (error) => {
//       console.error('Connection error:', error);
//       this.handleConnectionError(error);
//     });

//     this.socket.on('disconnect', (reason) => {
//       console.log('Disconnected:', reason);
//       this.handleDisconnected(reason);
//     });

//     this.socket.on('error', (error) => {
//       console.error('Socket error:', error);
//     });

//     // Authentication events
//     this.socket.on('authenticated', () => {
//       console.log('Successfully authenticated');
//       this.handleAuthenticated();
//     });

//     this.socket.on('unauthorized', (error) => {
//       console.error('Authentication failed:', error);
//       this.handleUnauthorized(error);
//     });
//   }

//   private handleConnected(): void {
//     // The server will automatically authenticate using the token
//     // You can add any post-connection logic here
//   }

//   private handleConnectionError(error: any): void {
//     if (error.message === 'Authentication failed') {
//       // Token might be expired, try to refresh
//       this.refreshTokenAndReconnect();
//     }
//   }

//   private async refreshTokenAndReconnect(): Promise<void> {
//     try {
//       const newToken = await this.refreshAuthToken();
//       this.socket.auth.token = newToken;
//       this.socket.connect();
//     } catch (error) {
//       console.error('Token refresh failed:', error);
//       // Redirect to login
//     }
//   }

//   private async refreshAuthToken(): Promise<string> {
//     // Implement your token refresh logic
//     const response = await fetch('/auth/refresh', {
//       method: 'POST',
//       credentials: 'include'
//     });

//     if (!response.ok) {
//       throw new Error('Token refresh failed');
//     }

//     const data = await response.json();
//     return data.access_token;
//   }

//   // Public methods
//   public joinChat(chatId: string): void {
//     this.socket.emit('joinChat', { chatId });
//   }

//   public sendMessage(chatId: string, content: string): void {
//     this.socket.emit('sendMessage', {
//       chatId,
//       content,
//       type: 'text'
//     });
//   }

//   public disconnect(): void {
//     this.socket.disconnect();
//   }

//   public getSocket(): Socket {
//     return this.socket;
//   }
// }