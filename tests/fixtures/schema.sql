
CREATE TABLE guest_ip_daily_usage (
	ip_hash VARCHAR(64) NOT NULL, 
	day DATE NOT NULL, 
	used INTEGER NOT NULL, 
	PRIMARY KEY (ip_hash, day)
)



CREATE TABLE users (
	id VARCHAR(36) NOT NULL, 
	clerk_user_id VARCHAR(64) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
)


CREATE UNIQUE INDEX ix_users_clerk_user_id ON users (clerk_user_id)

CREATE TABLE guest_sessions (
	id VARCHAR(36) NOT NULL, 
	token_hash VARCHAR(64) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	last_active_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	claimed_user_id VARCHAR(36), 
	claimed_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (token_hash), 
	FOREIGN KEY(claimed_user_id) REFERENCES users (id)
)


CREATE INDEX ix_guest_sessions_expires_at ON guest_sessions (expires_at)

CREATE TABLE conversations (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36), 
	guest_session_id VARCHAR(36), 
	title VARCHAR(160) NOT NULL, 
	summary TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_conversations_one_owner CHECK ((user_id IS NOT NULL AND guest_session_id IS NULL) OR (user_id IS NULL AND guest_session_id IS NOT NULL)), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(guest_session_id) REFERENCES guest_sessions (id) ON DELETE CASCADE
)


CREATE INDEX ix_conversations_guest_updated ON conversations (guest_session_id, updated_at)
CREATE INDEX ix_conversations_updated_at ON conversations (updated_at)
CREATE INDEX ix_conversations_user_updated ON conversations (user_id, updated_at)

CREATE TABLE guest_daily_usage (
	guest_session_id VARCHAR(36) NOT NULL, 
	day DATE NOT NULL, 
	used INTEGER NOT NULL, 
	PRIMARY KEY (guest_session_id, day), 
	FOREIGN KEY(guest_session_id) REFERENCES guest_sessions (id) ON DELETE CASCADE
)



CREATE TABLE messages (
	id VARCHAR(36) NOT NULL, 
	conversation_id VARCHAR(36) NOT NULL, 
	role VARCHAR(16) NOT NULL, 
	content TEXT NOT NULL, 
	sequence INTEGER NOT NULL, 
	metadata JSONB NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_messages_role CHECK (role IN ('user', 'assistant')), 
	CONSTRAINT uq_messages_conversation_sequence UNIQUE (conversation_id, sequence), 
	FOREIGN KEY(conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
)


CREATE INDEX ix_messages_conversation_created ON messages (conversation_id, created_at)