import type { Request, Response, NextFunction } from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFirebaseProjectId(): string | undefined {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  try {
    const configPath = path.resolve(__dirname, '../../firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { projectId?: string };
      return parsed.projectId;
    }
  } catch (err) {
    console.warn('Could not read firebase-applet-config.json:', err);
  }
  return undefined;
}

if (!getApps().length) {
  const projectId = loadFirebaseProjectId();
  initializeApp(projectId ? { projectId } : undefined);
}

const adminAuth = getAuth();

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Invalid authorization token.' });
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Firebase ID token verification failed:', err);
    res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
  }
}
