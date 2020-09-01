import * as admin from 'firebase-admin';

export interface Login
{
  email: string
  password: string
}

export interface UserToken
{
  id: string
  nickname: string
  imgUrl: string
}

export interface Author
{
  email: string
  nickname: string
  position: string
  imgUrl: string
}

export interface User extends Author
{
  password: string
}

export interface AuthorWithId extends Author
{
  id: string
}

export interface ArticleListItem
{
  author: Author
  title: string
  created: admin.firestore.Timestamp
  updated: admin.firestore.Timestamp
}

export interface Article
{
  author: AuthorWithId
  title: string
  content: string
  created: admin.firestore.Timestamp | admin.firestore.FieldValue
  updated: admin.firestore.Timestamp | admin.firestore.FieldValue
}

export interface ArticlePost
{
  title: string
  content: string
}

export interface ArticlePatch
{
  title?: string
  content?: string
}