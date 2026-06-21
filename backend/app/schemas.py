from pydantic import BaseModel


class GittensorScoreRequest(BaseModel):
    github_pat: str | None = None
