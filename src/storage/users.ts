import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '../users.json');

export interface User {
    id: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    addedAt: string;
}

export let userMap: Record<number, User> = {};

// Load existing users if file exists
try {
    if (fs.existsSync(DB_PATH)) {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        userMap = JSON.parse(data);
    } else {
        fs.writeFileSync(DB_PATH, JSON.stringify({}));
    }
} catch (error) {
    console.error('Error loading users:', error);
}

export const saveUser = (msg: any) => {
    const user = {
        id: msg.from!.id,
        username: msg.from!.username,
        firstName: msg.from!.first_name,
        lastName: msg.from!.last_name,
        addedAt: new Date().toISOString()
    };
    updateUser(user);
};

export const getUser = (userId: number): User | undefined => {
    return userMap[userId];
};

export const getAllUsers = (): User[] => {
    return Object.values(userMap);
};

export const updateUser = (user: User) => {
    userMap[user.id] = user;
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(userMap, null, 2));
    } catch (error) {
        console.error('Error saving users:', error);
    }
};

export const getUserByUsername = (username: string): User | undefined => {
    return Object.values(userMap).find(user => user.username === username.replace('@', ''));
};
