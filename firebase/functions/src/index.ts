import * as functions from 'firebase-functions';
import { admin, database as db } from './admin';
import * as express from 'express';
import * as cors from 'cors';
import * as types from './types';
import * as jwt from 'jsonwebtoken';
import config from './config';
//import * as bcrypt from 'bcrypt';

const SECRET = config.SECRET;

const app = express();
app.use(cors());

const blog = express.Router();

function authCheck(req: express.Request, res: express.Response, next: express.NextFunction)
{
  const auth = req.header('Authorization');
  const match = auth?.match(/^Bearer (.+)$/)
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
    jwt.verify(token, SECRET);
    res.locals.login = jwt.decode(token);
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
  const userSnapshot = await db.collection('/Users').where('email', '==', login.email).get();
  if (userSnapshot.docs?.length === 1)
  {
    const doc = userSnapshot.docs[0];
    const user = doc.data() as types.User;
    //if (bcrypt.compareSync(login.password, user.password))
    if (login.password == user.password)
    {
      const token = jwt.sign({
        id: doc.id,
        nickname: user.nickname,
        imgUrl: user.imgUrl
      } as types.UserToken, SECRET);
  
      res.status(200).json({
        success: {
          jwt: token
        }
      });
    }
    else
    {
      res.status(403).json({
        error: {
          code: 'NO-AUTH',
          message: 'you are not the one!'
        }
      });
    }
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
  const articlesSnapshot = await db.collection('/Articles').orderBy('created', 'desc').get();
  const articles: {
    articleId: string
    article: types.ArticleListItem
  }[] = articlesSnapshot.docs.map(doc =>
  {
    const article = doc.data() as types.Article;
    return {
      articleId: doc.id,
      article: {
        author: <types.Author> article.author,
        title: article.title,
        created: article.created as admin.firestore.Timestamp,
        updated: article.updated as admin.firestore.Timestamp
      }
    };
  });

  res.status(200).json({
    success: articles
  });
});

blog.post('/articles', authCheck, async function(req, res)
{
  const post = req.body as types.ArticlePost;
  const userToken = res.locals.login as types.UserToken

  const userDoc = await db.collection('/Users').doc(userToken.id).get();
  const user = userDoc.data() as types.User;
  const authorWithId: types.AuthorWithId = {
    id: userDoc.id,
    email: user.email,
    imgUrl: user.imgUrl,
    nickname: user.nickname,
    position: user.position
  };

  const article: types.Article = {
    author: authorWithId,
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
    const article = articleDoc.data() as types.Article;
    res.status(200).json({
      success: {
        articleId: articleDoc.id,
        article
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
    const userToken = res.locals.login as types.UserToken;
    const article = articleDoc.data() as types.Article;
    if (article.author.id !== userToken.id)
    {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'no authorization'
        }
      });
    }
    else
    {
      const patch = req.body as types.ArticlePost;
      const update = Object.assign({
        updated: admin.firestore.FieldValue.serverTimestamp()
      }, patch);
  
      await db.collection('/Articles').doc(id).update(update);
      res.status(201);
    }
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
    const userToken = res.locals.login as types.UserToken;
    const article = articleDoc.data() as types.Article;
    if (article.author.id !== userToken.id)
    {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'no authorization'
        }
      });
    }
    else
    {
      await db.collection('/Articles').doc(id).delete();
      res.status(201);
    }
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
