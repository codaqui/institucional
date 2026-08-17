export interface Ambassador {
  name: string;
  email: string;
  role: string;
  avatar?: string;
  linkedin?: string;
  github?: string;
  bio?: string;
}

export interface Region {
  id: string;
  name: string;
  cities: string[];
  ambassador?: Ambassador;
}

import data from "./ambassadors.json";

export const regions: Region[] = data.regions;
