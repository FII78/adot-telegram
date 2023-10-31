const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { fetchCategories, fetchTopics, fetchInsights, fetchInsightId, getStickerSetInfo, signup, login, createJournal,getImageInfo, getJournal,getVoiceInfo, fetchJournal } = require('./services/telegramService');
require('dotenv').config();
const player = require('play-sound')();
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const registrationData = {};
const inMemorySessions = {};
const ConversationState = {
  NONE: 'none',
  SIGNUP_PHONE: 'signup_phone',
  SIGNUP_FIRST_NAME: 'signup_first_name',
  SIGNUP_LAST_NAME: 'signup_last_name',
  LOGIN_PHONE: 'login_phone',
  LOGIN_PASSWORD: 'login_password',
  INSIGHT: 'insight',
  ADDING_JOURNAL: 'adding_journal',
  ADDING_JOURNAL_CONTENT: 'adding_journal_content',
  ADD_VOICE: 'add_voice',
  ADD_IMAGE: 'add_image',
  ADDING_JOURNAL_VOICE_IMAGE: ''
};
const userStates = {};
const bookEmojis = ['📚', '📖', '📕', '📗', '📘', '📙', '📔', '📚', '📖', '📕'];
const stickerSetName = 'PlushBabyBunny';
const userJournalData = {};


const webhookUrl = 'https://your-domain.com/webhook-endpoint';  


bot.setWebHook(webhookUrl).then(() => {
  console.log('Webhook set up!');
});

bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const phoneNumber = msg.contact.phone_number;

  const state = userStates[chatId];

  if (state === ConversationState.SIGNUP_PHONE) {
    registrationData[userId] = { phoneNumber };
    bot.sendMessage(chatId, 'What\'s your name mommy?');
    userStates[chatId] = ConversationState.SIGNUP_FIRST_NAME;
  } else if (state === ConversationState.LOGIN_PHONE) {
    registrationData[chatId] = { phoneNumber };
    bot.sendMessage(chatId, 'Please enter your password:');
    userStates[chatId] = ConversationState.LOGIN_PASSWORD;
  }
  
});

function startJournalProcess(chatId) {
  bot.sendMessage(chatId, 'What should we name today?');
  userStates[chatId] = ConversationState.ADDING_JOURNAL;
}


function chunkText(text, chunkSize) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function sendOptions(chatId) {
  const optionsKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📖 Read Insights',
            callback_data: 'read_blogs_clicked',
          },
          {
            text: 'Log In',
            callback_data: 'log_in_clicked',
          },

        ],
      ],
    },
  };
  
  bot.sendMessage(chatId, 'You have successfully signed up! What would you like to do now?', optionsKeyboard);
}

async function sendFirstInsight(chatId, insight) {
  const contentChunks = chunkText(insight.content, 1000);
  const insightMessage = `<b>${insight.title}</b><a href="${insight.thumbnailImage}">&#8205;</a>\n\n${contentChunks[0]}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: 'Next', callback_data: 'next_chunk' },
        { text: '🔙 Back to Main Menu', callback_data: 'back_to_main_menu' },
      ],
    ],
  };

   const message = await bot.sendMessage(chatId, insightMessage, {
                      reply_markup: keyboard,
                      parse_mode: 'HTML',
                    });

  inMemorySessions[chatId] = {
    state: ConversationState.INSIGHT,
    insightId: insight._id,
    insightMessageId: message.message_id,
    contentChunks: contentChunks,
    currentChunkIndex: 0,
    insight: insight,  
  };
}


async function updateInsight(chatId, action) {
  const session = inMemorySessions[chatId];

  if (session && session.state === ConversationState.INSIGHT) {
    if (action === 'next_chunk') {
      
              const nextChunkIndex = session.currentChunkIndex + 1;
              if (nextChunkIndex < session.contentChunks.length) {
                const contentChunk = session.contentChunks[nextChunkIndex];
        
                await bot.editMessageText(contentChunk, {
                  chat_id: chatId,
                  message_id: session.insightMessageId,
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: 'Previous', callback_data: 'prev_chunk' }],
                      nextChunkIndex < session.contentChunks.length - 1
                        ? [{ text: 'Next', callback_data: 'next_chunk' }]
                        : [{ text: '🔙 Back to Main Menu', callback_data: 'back_to_main_menu' }],
                    ],
                  },
                });
        
                session.currentChunkIndex = nextChunkIndex;
              }
            
    } else if (action === 'prev_chunk') {
      const prevChunkIndex = session.currentChunkIndex - 1;
      if (prevChunkIndex >= 0) {
        if (prevChunkIndex === 0) {
          // const insightMessage = `[${session.insight.title}](${session.insight.thumbnailImage})`;
          const insightMessage = `<b>${session.insight.title}</b><a href="${session.insight.thumbnailImage}">&#8205;</a>\n\n${session.contentChunks[0]}`;

          await bot.editMessageText(insightMessage, {
            chat_id: chatId,
            message_id: session.insightMessageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Next', callback_data: 'next_chunk' }],
                [{ text: '🔙 Back to Main Menu', callback_data: 'back_to_main_menu' }],
              ],
            },
            parse_mode: 'HTML',
          });
        } else {
          const contentChunk = session.contentChunks[prevChunkIndex];
          await bot.editMessageText(contentChunk, {
            chat_id: chatId,
            message_id: session.insightMessageId,
            reply_markup: {
              inline_keyboard: [
                prevChunkIndex > 0
                  ? [{ text: 'Previous', callback_data: 'prev_chunk' }]
                  : [],
                [{ text: 'Next', callback_data: 'next_chunk' }],
                [{ text: '🔙 Back to Main Menu', callback_data: 'back_to_main_menu' }],
              ],
            },
          });
        }

        session.currentChunkIndex = prevChunkIndex;
      }
    } else if (action === 'back_to_main_menu') {
      // Handle going back to the main menu or other actions
      // Update the user's state accordingly
      // ...
    }
  }
}


function requestPhoneNumber(chatId, state) {
  const request = {
    chat_id: chatId,
    text: 'Please share your phone number with us:',
    reply_markup: {
      keyboard: [
        [
          {
            text: 'Share My Phone Number',
            request_contact: true,
          },
        ],
      ],
      one_time_keyboard: true,
    },
  };

  userStates[chatId] = state;
 
  bot.sendMessage(chatId, request.text, {
    reply_markup: JSON.stringify(request.reply_markup),
  });
}

function generatePassword() {
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

  let password = '';

  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

  while (password.length < 8 || !password.match(passwordPattern)) {
    password = '';
    for (let i = 0; i < 8; i++) {
      const randomChar = charset[Math.floor(Math.random() * charset.length)];
      password += randomChar;
    }
  }

  return password;
}

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  
  if (data === 'read_blogs_clicked') {
    
    const stickerFileId = 'CAACAgIAAxUAAWU7PifuAAG6IYAojciURawVU-DCbgACRDAAAnKWOEsFrs68HEJi_DAE';
    const stickerMessage = await bot.sendSticker(chatId, stickerFileId);
   
    const categories = await fetchCategories();
      
      const randomBookEmoji = bookEmojis[Math.floor(Math.random() * bookEmojis.length)];
      
      
      const categoryButtons = categories.map((category) => {
        const { title, desc, _id, topics } = category;
        const buttonCaption = `${randomBookEmoji} ${title}`;

        return [{
          text: buttonCaption,
          callback_data: `category_${_id}`, 
        }];
      });

      
      const backButton = [{
        text: '🔙 Back to Main Menu',
        callback_data: 'back_to_main_menu',
      }];
   
      categoryButtons.push(backButton);

      const categoryKeyboard = {
        reply_markup: {
          inline_keyboard: categoryButtons,
        },
      };
      bot.deleteMessage(chatId, stickerMessage.message_id);
      bot.sendMessage(chatId, 'Choose a category:', categoryKeyboard);

  } 

  else if (data.startsWith('category_')) {
    const categoryId = data.replace('category_', '');
    const stickerFileId = 'CAACAgIAAxUAAWU7PifuAAG6IYAojciURawVU-DCbgACRDAAAnKWOEsFrs68HEJi_DAE';
    const stickerMessage = await bot.sendSticker(chatId, stickerFileId);
    
    const topics = await fetchTopics(categoryId);

    const topicButtons = topics.map((topic) => {
      const { title, description, _id } = topic;
      const buttonCaption = `${title}`;
      return [{
        text: buttonCaption,
        callback_data: `topic_${_id}`, 
      }];
    });

    
    const backButton = [{
      text: '🔙 Back to Main Menu',
      callback_data: 'back_to_main_menu',
    }];

 
    topicButtons.push(backButton);

    const topicKeyboard = {
      reply_markup: {
        inline_keyboard: topicButtons,
      },
    };
    bot.deleteMessage(chatId, stickerMessage.message_id);
    bot.sendMessage(chatId, 'Choose a topic:', topicKeyboard);

  }

  else if (data.startsWith('topic_')) {
    const topicId = data.replace('topic_', '');
    const stickerFileId = 'CAACAgIAAxUAAWU7PifuAAG6IYAojciURawVU-DCbgACRDAAAnKWOEsFrs68HEJi_DAE';
    const stickerMessage = await bot.sendSticker(chatId, stickerFileId);
    
   
    const insights = await fetchInsights(topicId);

    const numberedInsights = insights.map((insight, index) => {
      const { title, content } = insight;
      const insightMessage = `${index + 1}. ${title}`;
      return insightMessage;
    });
    
    const textMessage = numberedInsights.join('\n\n');
    bot.sendMessage(chatId, textMessage);
   
    const buttons = numberedInsights.map((_insightMessage, index) => {
      return {
        text: `${index + 1}`,
        callback_data: `insight_${insights[index]._id}`, 
      };
    });


    const buttonsInRows = [];
    const buttonsPerRow = 5;
    for (let i = 0; i < buttons.length; i += buttonsPerRow) {
      buttonsInRows.push(buttons.slice(i, i + buttonsPerRow));
    }

    const insightSelectionKeyboard = {
      reply_markup: {
        inline_keyboard: buttonsInRows,
      },
    };

    const backButton = [{
      text: '🔙 Back to Main Menu',
      callback_data: 'back_to_main_menu',
    }];
    buttonsInRows.push(backButton)
    // const backButtonKeyboard = {
    //   reply_markup: {
    //     inline_keyboard: [backButton],
    //   },
    // };
    bot.deleteMessage(chatId, stickerMessage.message_id);
    setTimeout(() => {
      bot.sendMessage(chatId, 'Select an insight by number:', insightSelectionKeyboard);
    }, 500);
   
      
  }

  else if (data.startsWith('insight_')) {
    const insightId = data.replace('insight_', '');
    const stickerFileId = 'CAACAgIAAxUAAWU7PifuAAG6IYAojciURawVU-DCbgACRDAAAnKWOEsFrs68HEJi_DAE';
    const stickerMessage = await bot.sendSticker(chatId, stickerFileId);
    
    const insight = await fetchInsightId(insightId);
    if (insight) {
      bot.deleteMessage(chatId, stickerMessage.message_id);

      sendFirstInsight(chatId, insight);
    }
  } 

  else if (data === 'next_chunk' || data === 'prev_chunk' || data === 'back_to_menu') {
    updateInsight(chatId, data);
  }
  
  else if (data === 'log_in_clicked') {
    requestPhoneNumber(chatId, ConversationState.LOGIN_PHONE);

  } 
  
  else if (data === 'sign_up_clicked') {
    requestPhoneNumber(chatId, ConversationState.SIGNUP_PHONE);
  }

  else if (data === 'add_info_clicked') {
    
    const insight = await getStickerSetInfo();
    console.log(insight.data.stickers)
  }

  else if (data === 'back_to_main_menu') {
    
    const optionsKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📖 Journal', callback_data: 'journal' },
            { text: '📝 Saved Insights', callback_data: 'saved_insights' },
          ],
          [
            { text: '📸 Read Insights ', callback_data: 'read_blogs_clicked' },
            { text: 'Log Out', callback_data: 'log_out' },
          ],
        ],
      },
    };

    bot.sendMessage(chatId, '🔙 Back to Main Menu:', optionsKeyboard);
  }

  else if (data === 'record_voice') {
    bot.sendMessage(chatId, 'Please start recording your voice.');
    userStates[chatId] = ConversationState.ADD_VOICE;
  } 
  
  else if (data === 'add_image') {
    bot.sendMessage(chatId, 'Please send an image for your journal.');
    userStates[chatId] = ConversationState.ADD_IMAGE;
  } 
  else if (data === 'start_journal') {
    startJournalProcess(chatId);
  } 
  else if (data.startsWith('read_journal_')) {
    const userId = query.from.id;
    const journalId = data.replace('read_journal_', '');
    const stickerFileId = 'CAACAgIAAxUAAWU7PifuAAG6IYAojciURawVU-DCbgACRDAAAnKWOEsFrs68HEJi_DAE';
    const stickerMessage = await bot.sendSticker(chatId, stickerFileId);
   
    const journal = await fetchJournal(journalId, userId);

    const journalMessage = `<b>${journal.title}</b>\n\n\n${journal.content}`;
    
    bot.sendMessage(chatId, journalMessage, {
      parse_mode: 'HTML',
    });
    const response = await getVoiceInfo(journal.voiceUrl)
  
    const responseImage = await getImageInfo(journal.imageUrl)

    

    const imageFileId = responseImage.data.result.file_id

    bot.getFile(imageFileId).then((response) => {
      if (response && response.file_path) {
        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${response.file_path}`;
  
        axios
          .get(fileUrl, { responseType: 'stream' })
          .then((imageResponse) => {
            if (imageResponse.status === 200) {
              bot.sendPhoto(chatId, imageResponse.data);
            } else {
              bot.sendMessage(chatId, 'Failed to retrieve the image file.');
            }
          })
          .catch((error) => {
            console.error(error);
            bot.sendMessage(chatId, 'Failed to retrieve the image file.');
          });
      } else {
        bot.sendMessage(chatId, 'Failed to retrieve the image file details.');
      }
    });
      
    const voiceFileId = response.data.result.file_id
    bot.getFile(voiceFileId).then((response) => {
      if (response && response.file_path) {
        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${response.file_path}`;
  
        axios
          .get(fileUrl, { responseType: 'stream' })
          .then((voiceResponse) => {
            if (voiceResponse.status === 200) {
              bot.sendVoice(chatId, voiceResponse.data);
            } else {
              bot.sendMessage(chatId, 'Failed to retrieve the voice file.');
            }
          })
          .catch((error) => {
            console.error(error);
            bot.sendMessage(chatId, 'Failed to retrieve the voice file.');
          });
      } else {
        bot.sendMessage(chatId, 'Failed to retrieve the voice file details.');
      }
    });
 bot.deleteMessage(chatId, stickerMessage.message_id);


 const featuresKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: '📸 Read Insights',
          callback_data: 'read_blogs_clicked',
        },
        { text: '📝 Read Journal', callback_data: 'read_journals' },
      ],
      [
        { text: '🔙 Back to Main', callback_data: 'back_to_main_menu' },
      ],
    ],
  },
};
const welcomeMessage = `
   Do you want to read more? 😊`;

  
  setTimeout(() => {
    bot.sendMessage(chatId, welcomeMessage, featuresKeyboard);
  },1000);
  }
  else if (data === 'read_journals') {
    const userId = query.from.id;
    const stickerFileId = 'CAACAgIAAxUAAWU7PifuAAG6IYAojciURawVU-DCbgACRDAAAnKWOEsFrs68HEJi_DAE';
    const stickerMessage = await bot.sendSticker(chatId, stickerFileId);
  

    const journals = await getJournal(userId);
      
      const randomBookEmoji = bookEmojis[Math.floor(Math.random() * bookEmojis.length)];
      
      
      const journalButtons = journals.map((journal) => {
        const { title, _id} = journal;
        const buttonCaption = `${randomBookEmoji} ${title}`;

        return [{
          text: buttonCaption,
          callback_data: `read_journal_${_id}`, 
        }];
      });

      
      const backButton = [{
        text: '🔙 Back to Main Menu',
        callback_data: 'back_to_main_menu',
      }];
   
      journalButtons.push(backButton);

      const journalKeyboard = {
        reply_markup: {
          inline_keyboard: journalButtons,
        },
      };

  
    bot.deleteMessage(chatId, stickerMessage.message_id);
    bot.sendMessage(chatId, 'Choose one of your journals to read!', journalKeyboard);
      
  } 

  else if (data === 'journal') {
    const featuresKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📖 Create Journal', callback_data: 'start_journal' },
            { text: '📝 Read Journal', callback_data: 'read_journals' },
          ],
          [
            { text: '🔙 Back to Main', callback_data: 'log_out' },
          ],
        ],
      },
    };
    const welcomeMessage = `
      🚀 Let's reflect on this wonderful day 😊`;
    
      bot.sendMessage(chatId, welcomeMessage, featuresKeyboard);

  }
  else if (data === 'finish_journal') {
   
    if (!userJournalData[chatId]) {
      bot.sendMessage(chatId, 'Data not found. Please create your journal again.');
      return;
    }
    if (!userJournalData[chatId].title || !userJournalData[chatId].content) {
      bot.sendMessage(chatId, 'Please provide both title and content before creating the journal.');
      return;
    }
  
    const title = userJournalData[chatId].title;
    const content = userJournalData[chatId].content;
    const voiceId = userJournalData[chatId].voice ;
    const photoId = userJournalData[chatId].photo ;

    const userId = query.from.id;
    const stickerFileId = 'CAACAgIAAxUAAWU7PieAdiJwD5KEygOLZNzZpIE4AAI8LAACYZc4S9VnxQFAzlttMAQ';
    const stickerMessage = await bot.sendSticker(chatId, stickerFileId);
    
    const response = await createJournal(title, content, userId, voiceId, photoId);
    
    if (response.data.statusCode === '200'){
    bot.deleteMessage(chatId, stickerMessage.message_id);

      const successJournal  = await bot.sendMessage(chatId, "Added your journal successfully")
      bot.deleteMessage(chatId, successJournal.message_id);
     
      const featuresKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📸 Read Insights',
                callback_data: 'read_blogs_clicked',
              },
              { text: '📝 Read Journal', callback_data: 'read_journals' },
            ],
            [
              { text: 'Back to Main', callback_data: 'log_out' },
            ],
          ],
        },
      };
      const welcomeMessage = `
         Let's read journals or read some insights! 😊`;
      
        bot.sendMessage(chatId, welcomeMessage, featuresKeyboard);
    }
  
  }
});


bot.onText(/(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = match[1];

  const state = userStates[chatId];

  if (state === ConversationState.SIGNUP_FIRST_NAME) {
    registrationData[userId].firstName = text;
    bot.sendMessage(chatId, 'Thank you! Now, please enter your last name:');
    userStates[chatId] = ConversationState.SIGNUP_LAST_NAME;
  } 
  else if (state === ConversationState.SIGNUP_LAST_NAME) {
    registrationData[userId].lastName = text;
    const generatedPassword = generatePassword();
    bot.sendMessage(chatId, `Your generated password: ${generatedPassword}\nThis password will be deleted in 5 minutes. Please save it securely.`);
    const registrationPayload = {
      phoneNumber: `+${registrationData[userId].phoneNumber}`,
      firstName: registrationData[userId].firstName,
      lastName: registrationData[userId].lastName,
      password: generatedPassword,
      isVerified: true
    };

    const registrationResult = await signup(registrationPayload);

    if (registrationResult.success) {
      sendOptions(chatId);
    } else {
      bot.sendMessage(chatId, 'Registration failed. Please try again later.');
    }

    setTimeout(() => {
      bot.deleteMessage(chatId, msg.message_id);
    }, 5 * 60 * 1000); // 5 minutes

    delete registrationData[userId];
    userStates[chatId] = ConversationState.NONE;
  }

  if (state === ConversationState.LOGIN_PASSWORD) {
    
    registrationData[chatId].password = text;

    const loginPayload = {
      phoneNumber: `+${registrationData[chatId].phoneNumber}`,
      password: registrationData[chatId].password,
    };
    
    const stickerFileId = 'CAACAgIAAxUAAWU7PifuAAG6IYAojciURawVU-DCbgACRDAAAnKWOEsFrs68HEJi_DAE';
    const stickerMessage = await bot.sendSticker(chatId, stickerFileId);

    const loginResult = await login(loginPayload, userId);
   
    if (loginResult === 200) {
      
      bot.deleteMessage(chatId, stickerMessage.message_id);
      
      const featuresKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📖 Journal', callback_data: 'journal' },
              { text: '📝 Saved Insights', callback_data: 'saved_insights' },
            ],
            [
              { text: '📸 Read Insights ', callback_data: 'read_blogs_clicked' },
              { text: 'Log Out', callback_data: 'log_out' },
            ],
          ],
        },
      };
    
      const welcomeMessage = `
      🚀 Welcome to Adot! 🚀   🎉 Login successful! 🎉  
      You are now ready to access the following features:
      Have fun exploring! If you have any questions or need assistance, feel free to ask. 😊
      `;

      bot.sendMessage(chatId, welcomeMessage, featuresKeyboard);
    } else {
      bot.sendMessage(chatId, 'Login failed. Please try again later.');
    }
   
    delete registrationData[chatId];
    userStates[chatId] = ConversationState.NONE;
  }
  if (state === ConversationState.ADDING_JOURNAL) {
    if (!userJournalData[chatId]) {
      userJournalData[chatId] = {};
    }
    userJournalData[chatId].title = text;
    bot.sendMessage(chatId, 'So, How was your day?');
    userStates[chatId] = ConversationState.ADDING_JOURNAL_CONTENT;
  } 
  else if (state === ConversationState.ADDING_JOURNAL_CONTENT) {
    if (!userJournalData[chatId]) {
      userJournalData[chatId] = {};
    }
    userJournalData[chatId].content = text;
    // Prompt the user for recording voice or adding an image
    
    const keyboard = {
      inline_keyboard: [
        [{ text: 'Record Voice', callback_data: 'record_voice' }],
        [{ text: 'Add Image', callback_data: 'add_image' }],
        [{ text: 'Finish', callback_data: 'finish_journal' }],
      ],
    };
    bot.sendMessage(chatId, 'Do you want to record voice or add an image?', { reply_markup: keyboard });
  }
  
});
 
bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  if (userStates[chatId] === ConversationState.ADD_VOICE) {
    const voiceFileId = msg.voice.file_id;

    const voiceUrl = `http://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${voiceFileId}`;
    
    userJournalData[chatId].voice = voiceUrl
    const voiceSucc = await bot.sendMessage(chatId, 'Voice recorded successfully!');

    userStates[chatId] = ConversationState.ADDING_JOURNAL;
    
  
    const keyboard = {
      inline_keyboard: [
        [{ text: 'Add Image', callback_data: 'add_image' }],
        [{ text: 'Finish', callback_data: 'finish_journal' }],
      ],
    };
    bot.sendMessage(chatId, 'Do you want to add an image?', { reply_markup: keyboard });
   
    setTimeout(() => {
      bot.deleteMessage(chatId, voiceSucc.message_id);
    }, 1000);
  }
});

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  if (userStates[chatId] === ConversationState.ADD_IMAGE) {
    const imageFileId = msg.photo[0].file_id;

    const imageUrl = `http://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${imageFileId}`;
    
    userJournalData[chatId].photo = imageUrl
    const imageSucc = await bot.sendMessage(chatId, 'Photo added successfully!');

    userStates[chatId] = ConversationState.ADDING_JOURNAL;
    const keyboard = {
      inline_keyboard: [
        [{ text: 'Finish', callback_data: 'finish_journal' }],
      ],
    };
    bot.sendMessage(chatId, 'Let me save your reflection', { reply_markup: keyboard });
    
    setTimeout(() => {
      bot.deleteMessage(chatId, imageSucc.message_id);
    }, 1000);
  }
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const botInfo = `
  *Adot: **Welcome to Your Pregnancy Companion bot!*

  🌸🤰👶 Hello, lovely! I'm here to guide you on your incredible journey to motherhood. As your pregnancy companion, I'm here to provide you with information, support, and a little bit of joy along the way.

  🌼 *What I can do for you:* 🌼

  - *Personalized Insights:* Get tailored information and insights based on your pregnancy stage and preferences. We're here to answer your questions and provide you with expert advice. 🧘‍♀️

  - *Journal Your Journey:* Capture and cherish every precious moment with our customizable journaling tools. Document your thoughts, emotions, and milestones in a way that's uniquely yours!  📅

  - *Q&A Channel:* Connect with our community and pregnancy experts on our dedicated Telegram channel. Have all your burning questions answered by knowledgeable professionals. 🤔
  
  🌟 Feel free to chat with me anytime, and together, we'll make your pregnancy experience truly special. *You're not alone on this beautiful journey!*
  `;

  bot.sendMessage(chatId, botInfo, { parse_mode: 'Markdown'});

  const optionsKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📸 Read Insights',
            callback_data: 'read_blogs_clicked',
          },
          {
            text: 'Sign Up',
            callback_data: 'sign_up_clicked',
          },
          {
            text: 'Log In',
            callback_data: 'log_in_clicked',
          }
          
        ],
      ],
    },
  };
  bot.sendMessage(chatId, 'Select an option:', optionsKeyboard);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'If you need help or assistance using our bot, Please reach out to contact-adot@a2sv.org');
});

bot.onText(/\/about/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'This bot is powered by A2SV.');
});
