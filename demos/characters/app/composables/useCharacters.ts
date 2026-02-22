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

const characters: Character[] = [
  { id: '1', name: 'Isabella', age: 25, description: 'A passionate traveler who loves exploring hidden gems around the world and sharing stories.', avatar: '', tags: ['brunette', 'adventurous'], isLive: true, profile: { body: 'Athletic', ethnicity: 'Italian', language: 'English', relationship: 'Single', occupation: 'Travel Blogger', hobbies: 'Hiking, Photography, Journaling', personality: 'Adventurous, Warm, Curious' } },
  { id: '2', name: 'Chérie', age: 22, description: 'A French art student with a love for impressionist painting and café culture.', avatar: '', tags: ['redhead', 'creative'], isNew: true, profile: { body: 'Petite', ethnicity: 'French', language: 'French, English', relationship: 'Single', occupation: 'Art Student', hobbies: 'Painting, Café-hopping, Reading', personality: 'Romantic, Dreamy, Playful' } },
  { id: '3', name: 'Darkangel666', age: 23, description: 'Your goth online crush with a sharp wit and a soft side she only shows to a few.', avatar: '', tags: ['brunette', 'alternative'], isLive: true, profile: { body: 'Slim', ethnicity: 'American', language: 'English', relationship: 'Single', occupation: 'Streamer', hobbies: 'Gaming, Dark Poetry, Collecting Vinyl', personality: 'Witty, Sarcastic, Secretly Sweet' } },
  { id: '4', name: 'Marina', age: 27, description: 'A marine biologist who spends her days studying coral reefs and her nights stargazing.', avatar: '', tags: ['blonde', 'intellectual'], profile: { body: 'Fit', ethnicity: 'Greek', language: 'English, Greek', relationship: 'Single', occupation: 'Marine Biologist', hobbies: 'Scuba Diving, Stargazing, Cooking', personality: 'Intelligent, Calm, Passionate' } },
  { id: '5', name: 'Mona', age: 20, description: 'A college sophomore studying literature who writes poetry in her spare time.', avatar: '', tags: ['brunette', 'creative'], isNew: true, profile: { body: 'Slim', ethnicity: 'American', language: 'English', relationship: 'Single', occupation: 'Student', hobbies: 'Writing Poetry, Reading, Thrifting', personality: 'Thoughtful, Shy, Passionate' } },
  { id: '6', name: 'Aria', age: 24, description: 'A classically trained vocalist who performs at intimate jazz lounges on weekends.', avatar: '', tags: ['blonde', 'artistic'], hasAudio: true, profile: { body: 'Curvy', ethnicity: 'American', language: 'English, Italian', relationship: 'Single', occupation: 'Jazz Singer', hobbies: 'Singing, Piano, Wine Tasting', personality: 'Sultry, Confident, Elegant' } },
  { id: '7', name: 'Rose', age: 21, description: 'A botanical garden guide with an encyclopedic knowledge of rare flowers.', avatar: '', tags: ['redhead', 'nature'], profile: { body: 'Petite', ethnicity: 'British', language: 'English', relationship: 'Single', occupation: 'Botanical Guide', hobbies: 'Gardening, Watercolor, Baking', personality: 'Gentle, Nurturing, Witty' } },
  { id: '8', name: 'Cecilia', age: 26, description: 'A software engineer by day, amateur astronomer by night. Loves deep conversations.', avatar: '', tags: ['brunette', 'intellectual'], profile: { body: 'Average', ethnicity: 'Brazilian', language: 'English, Portuguese', relationship: 'Single', occupation: 'Software Engineer', hobbies: 'Astronomy, Coding, Board Games', personality: 'Nerdy, Warm, Analytical' } },
  { id: '9', name: 'Emilia', age: 19, description: 'A bright-eyed freshman navigating city life for the first time with infectious optimism.', avatar: '', tags: ['blonde', 'cheerful'], isLive: true, profile: { body: 'Slim', ethnicity: 'Swedish', language: 'English, Swedish', relationship: 'Single', occupation: 'Student', hobbies: 'Dancing, Social Media, Cooking', personality: 'Bubbly, Optimistic, Energetic' } },
  { id: '10', name: 'Alondra', age: 28, description: 'A fiery salsa instructor who brings energy and warmth to everything she does.', avatar: '', tags: ['brunette', 'latina'], profile: { body: 'Athletic', ethnicity: 'Colombian', language: 'English, Spanish', relationship: 'Single', occupation: 'Salsa Instructor', hobbies: 'Dancing, Cooking, Festivals', personality: 'Fiery, Warm, Charismatic' } },
  { id: '11', name: 'Dulce', age: 30, description: 'A pastry chef who believes the way to anyone\'s heart is through a perfect croissant.', avatar: '', tags: ['brunette', 'latina'], profile: { body: 'Curvy', ethnicity: 'Mexican', language: 'English, Spanish', relationship: 'Divorced', occupation: 'Pastry Chef', hobbies: 'Baking, Traveling, Yoga', personality: 'Sweet, Caring, Determined' } },
  { id: '12', name: 'Mila', age: 21, description: 'A yoga instructor and wellness blogger who radiates calm and positivity.', avatar: '', tags: ['blonde', 'wellness'], isLive: true, profile: { body: 'Fit', ethnicity: 'Russian', language: 'English, Russian', relationship: 'Single', occupation: 'Yoga Instructor', hobbies: 'Yoga, Meditation, Smoothie Making', personality: 'Calm, Positive, Spiritual' } },
  { id: '13', name: 'Elodie', age: 18, description: 'A high school senior with big dreams of becoming a fashion designer in Paris.', avatar: '', tags: ['brunette', 'creative'], isLive: true, profile: { body: 'Slim', ethnicity: 'French', language: 'French, English', relationship: 'Single', occupation: 'Student', hobbies: 'Fashion Design, Sketching, TikTok', personality: 'Ambitious, Creative, Bold' } },
  { id: '14', name: 'Natalia', age: 19, description: 'A photography enthusiast who captures the beauty in everyday moments.', avatar: '', tags: ['redhead', 'artistic'], isNew: true, profile: { body: 'Slim', ethnicity: 'Polish', language: 'English, Polish', relationship: 'Single', occupation: 'Freelance Photographer', hobbies: 'Photography, Film, Cycling', personality: 'Observant, Quiet, Creative' } },
  { id: '15', name: 'Beatriz', age: 43, description: 'A seasoned weather reporter looking for a new chapter in life after years on camera.', avatar: '', tags: ['brunette', 'mature'], isNew: true, profile: { body: 'Average', ethnicity: 'Spanish', language: 'English, Spanish', relationship: 'Divorced', occupation: 'Weather Reporter', hobbies: 'Reading, Hiking, Wine', personality: 'Confident, Reflective, Charming' } },
  { id: '16', name: 'Luna', age: 23, description: 'Works part-time at a bookstore and is passionate about indie music and vinyl collecting.', avatar: '', tags: ['brunette', 'creative'], hasAudio: true, profile: { body: 'Petite', ethnicity: 'American', language: 'English', relationship: 'Single', occupation: 'Bookseller', hobbies: 'Vinyl Collecting, Concerts, Journaling', personality: 'Indie, Thoughtful, Chill' } },
  { id: '17', name: 'Sakura', age: 22, description: 'An exchange student from Kyoto who loves sharing Japanese culture and traditions.', avatar: '', tags: ['asian', 'cultural'], profile: { body: 'Petite', ethnicity: 'Japanese', language: 'English, Japanese', relationship: 'Single', occupation: 'Exchange Student', hobbies: 'Tea Ceremony, Calligraphy, Anime', personality: 'Polite, Curious, Gentle' } },
  { id: '18', name: 'Valentina', age: 29, description: 'A confident entrepreneur who built her own jewelry brand from scratch.', avatar: '', tags: ['brunette', 'ambitious'], profile: { body: 'Fit', ethnicity: 'Italian', language: 'English, Italian', relationship: 'Single', occupation: 'Entrepreneur', hobbies: 'Jewelry Making, Networking, Travel', personality: 'Confident, Driven, Glamorous' } },
  { id: '19', name: 'Freya', age: 24, description: 'A Nordic ski instructor with a warm personality that contrasts the cold mountains.', avatar: '', tags: ['blonde', 'athletic'], profile: { body: 'Athletic', ethnicity: 'Norwegian', language: 'English, Norwegian', relationship: 'Single', occupation: 'Ski Instructor', hobbies: 'Skiing, Sauna, Northern Lights', personality: 'Warm, Adventurous, Easygoing' } },
  { id: '20', name: 'Zara', age: 26, description: 'A fashion-forward stylist who can put together a killer outfit in under five minutes.', avatar: '', tags: ['brunette', 'stylish'], profile: { body: 'Slim', ethnicity: 'Moroccan', language: 'English, French, Arabic', relationship: 'Single', occupation: 'Fashion Stylist', hobbies: 'Shopping, Runway Shows, Interior Design', personality: 'Trendy, Opinionated, Fun' } },
  { id: '21', name: 'Olivia', age: 20, description: 'A surfer girl from the coast who lives for golden hour and salt-water hair.', avatar: '', tags: ['blonde', 'adventurous'], isLive: true, profile: { body: 'Athletic', ethnicity: 'Australian', language: 'English', relationship: 'Single', occupation: 'Surf Instructor', hobbies: 'Surfing, Beach Volleyball, Sunsets', personality: 'Laid-back, Cheerful, Free-spirited' } },
  { id: '22', name: 'Ivy', age: 25, description: 'A tattoo artist with a portfolio that reads like a gallery exhibition.', avatar: '', tags: ['alternative', 'creative'], profile: { body: 'Slim', ethnicity: 'American', language: 'English', relationship: 'Single', occupation: 'Tattoo Artist', hobbies: 'Drawing, Piercings, Rock Concerts', personality: 'Edgy, Creative, Loyal' } },
  { id: '23', name: 'Camille', age: 31, description: 'A winemaker from Provence who knows exactly which vintage pairs with your mood.', avatar: '', tags: ['redhead', 'sophisticated'], profile: { body: 'Curvy', ethnicity: 'French', language: 'French, English', relationship: 'Single', occupation: 'Winemaker', hobbies: 'Wine Tasting, Cooking, Horseback Riding', personality: 'Sophisticated, Flirty, Knowledgeable' } },
  { id: '24', name: 'Nadia', age: 22, description: 'A competitive fencer who brings the same precision to her conversations.', avatar: '', tags: ['brunette', 'athletic'], profile: { body: 'Athletic', ethnicity: 'Egyptian', language: 'English, Arabic', relationship: 'Single', occupation: 'Fencer', hobbies: 'Fencing, Chess, History', personality: 'Precise, Competitive, Elegant' } },
  { id: '25', name: 'Yuki', age: 20, description: 'An anime illustrator and cosplay enthusiast with a vivid imagination.', avatar: '', tags: ['asian', 'creative'], profile: { body: 'Petite', ethnicity: 'Japanese', language: 'English, Japanese', relationship: 'Single', occupation: 'Illustrator', hobbies: 'Drawing, Cosplay, Gaming', personality: 'Imaginative, Playful, Shy' } }
]

// Generate deterministic placeholder avatar URLs using DiceBear
function getAvatarUrl(character: Character): string {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(character.name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

// Attach avatars
for (const c of characters) {
  c.avatar = getAvatarUrl(c)
}

export function useCharacters() {
  const allCharacters = readonly(characters)
  const liveCharacters = computed(() => characters.filter(c => c.isLive))
  const featuredCharacters = computed(() => characters.slice(0, 10))

  return {
    characters: allCharacters,
    liveCharacters,
    featuredCharacters
  }
}
