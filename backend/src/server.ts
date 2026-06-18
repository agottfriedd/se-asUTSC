import express         from 'express';
import cors            from 'cors';
import helmet          from 'helmet';
import dotenv          from 'dotenv';
import { lessonsRouter }    from './routes/lessons';
import { dictionaryRouter } from './routes/dictionary';
import { usersRouter }      from './routes/users';
import { analyticsRouter }  from './routes/analytics';
import { progressRouter }   from './routes/progress';

dotenv.config();

const app  = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api/lessons',    lessonsRouter);
app.use('/api/dictionary', dictionaryRouter);
app.use('/api/users',      usersRouter);
app.use('/api/analytics',  analyticsRouter);
app.use('/api/progress',   progressRouter);

app.use((_, res) => res.status(404).json({ error: 'Not found' }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`SeñasUTSCMX API → http://localhost:${PORT}`));
export default app;
