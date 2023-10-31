
const axios = require('axios');
require('dotenv').config();
const FormData = require('form-data');

backendApiUrl = process.env.BACKEND_API_URL

const botToken = process.env.BOT_TOKEN;
const stickerSetName = 'PlushBabyBunny';  

const apiUrl = `https://api.telegram.org/bot${botToken}/getStickerSet?name=${stickerSetName}/`;


async function getProfile(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`
  };

  const userProfile = await axios.get(`${backendApiUrl}api/profile`, {headers});
  return userProfile.data.data.user._id
}

async function createJournal(title, content, userId, voiceId, photoId) {
  
  const sessionGetResponse = await axios.get(`${backendApiUrl}api/session/user/${userId}`);
  const accessToken = sessionGetResponse.data.data.accessToken;

  userObjectId = await getProfile(accessToken)

  const formData = new FormData();
  formData.append('title', title);
  formData.append('userId', userObjectId);
  formData.append('content', content);
  formData.append('imageUrl', photoId);
  
  formData.append('voiceUrl', voiceId);
  
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      ...formData.getHeaders(),
    };

    try {
      const response = await axios.post(`${backendApiUrl}api/journal/create`, formData, {
        headers,
      });
      return response
    } catch (error) {
      return error
    }
   
  }

  async function getJournal(userId) {
    const sessionGetResponse = await axios.get(`${backendApiUrl}api/session/user/${userId}`);
    const accessToken = sessionGetResponse.data.data.accessToken;
  
    userObjectId = await getProfile(accessToken)
    console.log(userObjectId)
    const headers = {
      Authorization: `Bearer ${accessToken}`
    };
  
    const response = await axios.get(`${backendApiUrl}api/journal` , {headers});
    console.log(response)
  
    return response.data.data
      
  }

   
  async function fetchJournal(journalId, userId) {
    const sessionGetResponse = await axios.get(`${backendApiUrl}api/session/user/${userId}`);
    const accessToken = sessionGetResponse.data.data.accessToken;
  
    userObjectId = await getProfile(accessToken)
    const headers = {
      Authorization: `Bearer ${accessToken}`
    };
  
    const response = await axios.get(`${backendApiUrl}api/journal/${journalId}`, {headers});
    console.log(response);
    return response.data.data;
  }
  
  async function getStickerSetInfo() {
    const response = await axios.get(apiUrl);
    return response
}

async function getVoiceInfo(voiceUrl) {
  const response = await axios.get(voiceUrl);
  return response
}
async function getImageInfo(imageUrl) {
  const response = await axios.get(imageUrl);
  return response
  
}

async function getSticker(fileId) {
  const response = await axios.get(`${apiUrl}${fileId}`);
  return response
  
}

async function fetchCategories() {
  const response = await axios.get(`${backendApiUrl}api/category`);
  return response.data.data;
}

async function fetchTopics(category) {
  const response = await axios.get(`${backendApiUrl}api/topic/category/${category}`);
  return response.data.data;
}

async function fetchInsights(topic) {
  const response = await axios.get(`${backendApiUrl}api/insight/bytopic/${topic}`);
  return response.data.data;
}

async function signup(payload) {
  try {
    const response = await axios.post(`${backendApiUrl}api/signup`, payload);
    if (response.status === 200) {
      return { success: true };
    }
  } catch (error) {
    console.error('Registration failed:', error);
  }
  return { success: false };
}

async function login(payload, userId) {
  try {
    const loginResponse = await axios.post(`${backendApiUrl}api/login`, payload);
    
    if (loginResponse.status === 200) {
      const sessionData = {
        userId: userId,
        accessToken: loginResponse.data.data.tokens.accessToken,
        refreshToken: loginResponse.data.data.tokens.refreshToken,
      };
    
         
          try {
          const sessionCreateResponse = await axios.post(`${backendApiUrl}api/session/create`, sessionData);
          if (sessionCreateResponse.status === 200) {
            return sessionCreateResponse.status;
          } 
          else {
            console.error('Failed to create a session:', sessionCreateResponse.statusText);
          }
        }
       catch (sessionCreateResponse) {
          console.error('Failed to create a session');
        }
    } else {
      console.error('Failed to log in:', loginResponse.statusText);
    }
  } catch (loginError) {
    console.error('Failed to log in:', loginError);
  }
  delete loginResponse; 
  return { success: false };
  
}

async function fetchInsightId(insight) {
  const response = await axios.get(`${backendApiUrl}api/web/insight/${insight}`);
  return response.data.data;
}


  


 
module.exports = {
  fetchCategories,
  fetchTopics,
  fetchInsights,
  fetchInsightId,
  getStickerSetInfo,
  signup,
  login,
  getSticker,
  createJournal,
  getJournal,
  getVoiceInfo,
  fetchJournal,
  getImageInfo
};





