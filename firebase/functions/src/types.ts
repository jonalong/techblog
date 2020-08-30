export interface Login
{
  email: string
  password: string
}

export interface LoginToken
{
  id: string,
  nickname: string
}

export interface Article
{
  authorId: string
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