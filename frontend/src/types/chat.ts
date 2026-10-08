export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  dateGroup: 'Today' | 'Yesterday' | 'Previous Days';
}
