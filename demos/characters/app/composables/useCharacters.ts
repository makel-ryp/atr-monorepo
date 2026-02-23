export interface CharacterProfile {
  body: string
  ethnicity: string
  language: string
  relationship: string
  occupation: string
  hobbies: string
  personality: string
}

export interface Character {
  id: string
  name: string
  age: number
  description: string
  avatar: string
  tags: string[]
  profile: CharacterProfile
  isNew?: boolean
  isLive?: boolean
  hasAudio?: boolean
}

function getAvatarUrl(name: string): string {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

export function useCharacters() {
  const { data: rawCharacters, status } = useFetch<Character[]>('/api/characters', {
    default: () => []
  })

  // Attach fallback avatar URLs for characters without one
  const characters = computed(() =>
    rawCharacters.value.map(c => ({
      ...c,
      avatar: c.avatar || getAvatarUrl(c.name)
    }))
  )

  const liveCharacters = computed(() => characters.value.filter(c => c.isLive))
  const featuredCharacters = computed(() => characters.value.slice(0, 10))

  return {
    characters,
    status,
    liveCharacters,
    featuredCharacters
  }
}
