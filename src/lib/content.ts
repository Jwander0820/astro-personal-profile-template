import { getCollection } from 'astro:content';

export async function getProfile() {
  const profiles = await getCollection('profile');
  const profile = profiles.find((entry) => entry.id === 'main');
  if (!profile) throw new Error('Missing src/content/profile/main.md');
  return profile;
}

export async function getLinks() {
  return (await getCollection('links'))
    .filter((entry) => entry.data.visible)
    .sort((a, b) => a.data.order - b.data.order);
}

export async function getSections() {
  return (await getCollection('sections'))
    .filter((entry) => entry.data.visible)
    .sort((a, b) => a.data.order - b.data.order);
}

export async function getBlocks() {
  return (await getCollection('blocks'))
    .filter((entry) => entry.data.visible)
    .sort((a, b) => a.data.order - b.data.order);
}

export async function getBlock(id: string) {
  return (await getCollection('blocks')).find((entry) => entry.id === id);
}

export async function getFortunes() {
  return (await getCollection('fortunes')).filter((entry) => entry.data.visible);
}
