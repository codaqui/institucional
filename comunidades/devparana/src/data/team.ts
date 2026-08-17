export interface Member {
  name: string;
  role: string;
  specialty?: string;
  avatar: string;
  linkedin?: string;
  github?: string;
}

import data from "./team.json";

export const team: Member[] = data.members;
