import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'dart:convert';
import 'package:http/http.dart' as http;

// Configuration for local development
// Use your machine's local IP if testing on a real device
const String baseUrl = 'http://10.0.2.2:8000'; // Android emulator localhost
const String socketUrl = 'http://10.0.2.2:3001';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Chat App',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const LoginScreen(),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _userController = TextEditingController();
  final TextEditingController _passController = TextEditingController();
  String? token;

  Future<void> login() async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/token/'),
      body: {'username': _userController.text, 'password': _passController.text},
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      setState(() {
        token = data['access'];
      });
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => ChatScreen(token: token!, username: _userController.text)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Login')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(controller: _userController, decoration: const InputDecoration(labelText: 'Username')),
            TextField(controller: _passController, decoration: const InputDecoration(labelText: 'Password'), obscureText: true),
            ElevatedButton(onPressed: login, child: const Text('Login')),
          ],
        ),
      ),
    );
  }
}

class ChatScreen extends StatefulWidget {
  final String token;
  final String username;
  const ChatScreen({super.key, required this.token, required this.username});

  @override
  _ChatScreenState createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late IO.Socket socket;
  final TextEditingController _controller = TextEditingController();
  List<Map<String, dynamic>> messages = [];
  List<Map<String, dynamic>> groups = [];
  String room = "general";
  int? currentGroupId;

  @override
  void initState() {
    super.initState();
    initSocket();
    fetchHistory();
    fetchGroups();
  }

  void initSocket() {
    socket = IO.io(socketUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'auth': {'token': 'Bearer ${widget.token}'}
    });
    socket.connect();
    socket.emit('join_room', room);
    socket.on('receive_message', (data) {
      if (mounted) {
        setState(() {
          messages.add(data);
        });
      }
    });
  }

  Future<void> fetchGroups() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/groups/'),
      headers: {'Authorization': 'Bearer ${widget.token}'},
    );
    if (response.statusCode == 200) {
      setState(() {
        groups = List<Map<String, dynamic>>.from(json.decode(response.body));
      });
    }
  }

  Future<void> fetchHistory() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/messages/?room=$room'),
      headers: {'Authorization': 'Bearer ${widget.token}'},
    );
    if (response.statusCode == 200) {
      setState(() {
        messages = List<Map<String, dynamic>>.from(json.decode(response.body));
      });
    }
  }

  void sendMessage() {
    if (_controller.text.isNotEmpty) {
      socket.emit('send_message', {
        'room': room,
        'content': _controller.text,
        'sender': {'username': widget.username},
        'group_id': currentGroupId
      });
      _controller.clear();
    }
  }

  void switchRoom(String newRoom, {int? groupId}) {
    socket.emit('join_room', newRoom);
    setState(() {
      room = newRoom;
      currentGroupId = groupId;
      messages = [];
    });
    fetchHistory();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Chat: $room')),
      drawer: Drawer(
        child: ListView(
          children: [
            const DrawerHeader(child: Text('Chats & Groups')),
            ListTile(
              title: const Text('General Room'),
              onTap: () {
                switchRoom('general');
                Navigator.pop(context);
              },
            ),
            const Divider(),
            const Padding(
              padding: EdgeInsets.all(8.0),
              child: Text('Groups', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            ...groups.map((group) => ListTile(
              title: Text(group['name']),
              onTap: () {
                switchRoom('group_${group['id']}', groupId: group['id']);
                Navigator.pop(context);
              },
            )).toList(),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              itemCount: messages.length,
              itemBuilder: (context, index) {
                final msg = messages[index];
                final sender = msg['sender'] is Map ? msg['sender']['username'] : msg['sender'];
                final isVoice = msg['voice_note'] != null;
                
                return ListTile(
                  title: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(sender ?? 'Unknown'),
                      if (msg['timestamp'] != null)
                        Text(
                          msg['timestamp'].toString().substring(11, 16),
                          style: const TextStyle(fontSize: 10, color: Colors.grey),
                        ),
                    ],
                  ),
                  subtitle: isVoice 
                    ? const Row(
                        children: [
                          Icon(Icons.mic, size: 16, color: Colors.blue),
                          SizedBox(width: 5),
                          Text('Voice Note'),
                        ],
                      )
                    : Text(msg['content'] ?? ''),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                Expanded(child: TextField(controller: _controller)),
                IconButton(icon: const Icon(Icons.send), onPressed: sendMessage),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
