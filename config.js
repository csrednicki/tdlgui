module.exports = {
    sessionId: null,
    concurrentJobs: process.env.DL_WORKERS,
    mongoDbUrl: process.env.MONGODB_URI,
    downloadPath: './downloads/',
    resources: 'http://resources.wimpmusic.com/',
    api: 'https://api.tidalhifi.com/',
    quality: 'high',
    countryCode: 'PL',
    userAgent: 'TIDAL/362 CFNetwork/758.3.15 Darwin/15.4.0',
    userCredentials: {
        login: process.env.T_LOGIN,
        password: process.env.T_PASSWD
    },
    clients: {
        ios: {
            token: process.env.T_IOS_TOKEN,
            userAgent: '',
            version: '',
            key: ''
        },
        android: {
            token: process.env.T_ANDROID_TOKEN,
            userAgent: 'TIDAL_ANDROID/680 okhttp/3.3.1',
            version: '1.12.2',
            key: '3e7e98ab57024d8c'
        },
        pc: {
            token: process.env.T_PC_TOKEN,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.104 Safari/537.36',
            version: '',
            key: ''
        }
    }
};