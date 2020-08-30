import * as functions from 'firebase-functions';
import { admin, database as db } from './admin';
import * as express from 'express';
import * as cors from 'cors';
import * as types from './types';
import * as jwt from 'jsonwebtoken';

const SECRET = 'f8464c55fa033d16c4c80bd0fe7742b9ab54bca17cbc84d2cc4a43f564df93137ffa6c90883c6f58fdcea133798bcd7a9a00d3f7864fe45c83b60c8550229767';

const app = express();
app.use(cors());

const blog = express.Router();

function authCheck(req: express.Request, res: express.Response, next: express.NextFunction)
{
  const auth = req.header('authorization');
  const match = auth?.match(/^Bearer: (.+)$/)
  if (!match)
  {
    res.status(401).json({
      error: {
        code: 'NO-AUTH',
        message: 'login first!'
      }
    });
  }

  const token = (match as RegExpMatchArray)[1];
  try
  {
    const decoded = jwt.verify(token, SECRET) as any;
    res.locals.login = decoded.payload
  }
  catch
  {
    res.status(401).json({
      error: {
        code: 'NO-AUTH',
        message: 'login first!'
      }
    });
  }

  next();
}

app.post('/auth/login', async function(req, res)
{
  const login = req.body as types.Login;
  const matchedUserSnapshot = await db.collection('/Users')
    .where('email', '==', login.email)
    .where('password', '==', login.password)
    .get();
  if (matchedUserSnapshot.docs?.length === 1)
  {
    const doc = matchedUserSnapshot.docs[0];
    const token = jwt.sign({
      id: doc.id,
      nickname: doc.data().nickname
    }, SECRET);

    res.status(200).json({
      success: {
        jwt: token
      }
    });
  }
  else
  {
    res.status(404).json({
      error: {
        code: 'NO-USER',
        message: 'no user!'
      }
    });
  }
});

blog.get('/articles', async function(req, res)
{
  const articlesSnapshot = await db.collection('/Articles').orderBy('created_datetime', 'desc').get();
  const articles = articlesSnapshot.docs.map(doc =>
  {
    const article = doc.data();
    return {
      id: doc.id,
      author: article.author,
      title: article.title,
      created_datetime: article.created_datetime,
      updated_datetime: article.updated_datetime
    };
  });

  res.status(200).json({
    success: articles
  });
});

blog.post('/articles', authCheck, async function(req, res)
{
  const post = req.body as types.ArticlePost;
  const article = {
    user: res.locals.login,
    title: post.title,
    content: post.content,
    created: admin.firestore.FieldValue.serverTimestamp(),
    updated: admin.firestore.FieldValue.serverTimestamp()
  }
  const articleDoc = await db.collection('/Articles').add(article);
  res.status(200).json({
    success: {
      id: articleDoc.id,
    }
  });
});

blog.get('/articles/:id', async function(req, res)
{
  const id = req.params.id;
  const articleDoc = await db.collection('/Articles').doc(id).get();
  if (articleDoc.exists)
  {
    const article = articleDoc.data();
    res.status(200).json({
      success: {
        id: articleDoc.id,
        author: article?.author,
        title: article?.title,
        created_datetime: article?.created_datetime,
        updated_datetime: article?.updated_datetime
      }
    });
  }
  else
  {
    res.status(404).json({
      error: {
        code: 'NOT-FOUND',
        message: 'not found'
      }
    });
  }
});

blog.patch('/articles/:id', authCheck, async function(req, res)
{
  const id = req.params.id;
  const articleDoc = await db.collection('/Articles').doc(id).get();
  if (articleDoc.exists)
  {
    if (articleDoc.id !== (res.locals.login as types.LoginToken).id)
    {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'no authorization'
        }
      });
    }

    const patch = req.body as types.ArticlePost;
    const update = Object.assign({
      updated: admin.firestore.FieldValue.serverTimestamp()
    }, patch);

    await db.collection('/Articles').doc(id).update(update);
  }
  else
  {
    res.status(404).json({
      error: {
        code: 'NOT-FOUND',
        message: 'not found'
      }
    });
  }
  
  
});

blog.delete('/articles/:id', authCheck, async function(req, res)
{
  const id = req.params.id;
  const articleDoc = await db.collection('/Articles').doc(id).get();
  if (articleDoc.exists)
  {
    if (articleDoc.id !== (res.locals.login as types.LoginToken).id)
    {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'no authorization'
        }
      });
    }
    await db.collection('/Articles').doc(id).delete();
  }
  else
  {
    res.status(404).json({
      error: {
        code: 'NOT-FOUND',
        message: 'not found'
      }
    });
  }
})

app.use('/blog', blog);

exports.api = functions.https.onRequest(app);
