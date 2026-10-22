/* Three languages like the phone app. t('key', {x: 1}) */
const STRINGS = {
  uz: {
    appName: 'School17 O\'qituvchi', signIn: 'Kirish', phone: 'Telefon', email: 'E-pochta', password: 'Parol',
    phoneHint: 'Telefon raqamingiz (+998...)', sendCode: 'Kod yuborish', code: '6 xonali kod', codeSent: 'Kod Telegram orqali yuborildi.',
    verify: 'Tasdiqlash', back: 'Orqaga', needProfile: 'Bu raqam bilan hisob yo\'q. Avval telefondagi ilovada o\'qituvchi sifatida ro\'yxatdan o\'ting.',
    teachersOnly: 'Bu dastur faqat o\'qituvchilar uchun. Telefondagi ilovadan foydalaning.',
    logout: 'Chiqish', myClasses: 'Mening sinflarim', noClasses: 'Hali sinf yo\'q. Sinfni telefondagi ilovada yarating.',
    topicVideos: 'Mavzu videolari', topicVideosSub: 'YouTube / Vimeo havolalari', pupils: 'o\'quvchi',
    dropTitle: 'Videolarni shu yerga tashlang', dropSub: 'yoki bosib tanlang', alsoPost: 'Sinf chatiga xabar yozish', newVideo: 'Yangi video',
    uploading: 'Yuklanmoqda', done: 'Tayyor', failed: 'Xato', retry: 'Qayta urinish', cancel: 'Bekor qilish', cancelled: 'Bekor qilindi',
    videos: 'Videolar', noVideos: 'Hali video yo\'q. Birinchisini yuqoriga tashlang.', play: 'Ko\'rish', remove: 'O\'chirish',
    allowDl: 'Yuklab olishga ruxsat', confirmRemove: 'Bu videoni o\'chirasizmi?', preparing: 'Tayyorlanmoqda...',
    search: 'Qidirish', noTopics: 'Mavzu topilmadi.', addVideo: 'Video qo\'shish', url: 'Havola (YouTube yoki Vimeo)', vTitle: 'Sarlavha', vLang: 'Til',
    save: 'Saqlash', saved: 'Qo\'shildi', mine: 'Mening', open: 'Ochish', close: 'Yopish', loading: 'Yuklanmoqda...', reload: 'Yangilash',
    errNetwork: 'Internet yoki server bilan bog\'lanib bo\'lmadi. Server uyg\'onishi uchun biroz kuting va qayta urining.',
    errTimeout: 'Server javob bermadi. Qayta urinib ko\'ring.', errGeneric: 'Xatolik yuz berdi', errBadLogin: 'Noto\'g\'ri ma\'lumot',
    urlBad: 'Faqat YouTube yoki Vimeo havolasi mumkin.', dup: 'Bu video allaqachon qo\'shilgan.', tooMany: 'Bu mavzuda videolar juda ko\'p.', verifiedOnly: 'Faqat tasdiqlangan o\'qituvchilar video qo\'sha oladi.',
    noContacts: 'Sarlavhada aloqa ma\'lumotlari bo\'lmasin.', typeNotAllowed: 'Bu fayl turi mumkin emas.', quota: 'Xotira joyi tugadi.',
    dropHere: 'Qo\'yib yuboring', subject: 'Fanlar', all: 'Hammasi', retryLoad: 'Qayta yuklash', files: 'fayl',
  },
  ru: {
    appName: 'School17 Учитель', server: 'Сервер', signIn: 'Войти', phone: 'Телефон', email: 'Эл. почта', password: 'Пароль',
    phoneHint: 'Ваш номер (+998...)', sendCode: 'Отправить код', code: '6-значный код', codeSent: 'Код отправлен в Telegram.',
    verify: 'Подтвердить', back: 'Назад', needProfile: 'Для этого номера нет аккаунта. Сначала зарегистрируйтесь учителем в мобильном приложении.',
    teachersOnly: 'Эта программа только для учителей. Используйте мобильное приложение.',
    logout: 'Выйти', myClasses: 'Мои классы', noClasses: 'Классов пока нет. Создайте класс в мобильном приложении.',
    topicVideos: 'Видео по темам', topicVideosSub: 'Ссылки YouTube / Vimeo', pupils: 'учеников',
    dropTitle: 'Перетащите видео сюда', dropSub: 'или нажмите, чтобы выбрать', alsoPost: 'Написать в чат класса', newVideo: 'Новое видео',
    uploading: 'Загрузка', done: 'Готово', failed: 'Ошибка', retry: 'Повторить', cancel: 'Отмена', cancelled: 'Отменено',
    videos: 'Видео', noVideos: 'Видео пока нет. Перетащите первое выше.', play: 'Смотреть', remove: 'Удалить',
    allowDl: 'Разрешить скачивание', confirmRemove: 'Удалить это видео?', preparing: 'Подготовка...',
    search: 'Поиск', noTopics: 'Темы не найдены.', addVideo: 'Добавить видео', url: 'Ссылка (YouTube или Vimeo)', vTitle: 'Название', vLang: 'Язык',
    save: 'Сохранить', saved: 'Добавлено', mine: 'Моё', open: 'Открыть', close: 'Закрыть', loading: 'Загрузка...', reload: 'Обновить',
    errNetwork: 'Нет связи с интернетом или сервером. Подождите, пока сервер проснётся, и повторите.',
    errTimeout: 'Сервер не отвечает. Попробуйте ещё раз.', errGeneric: 'Произошла ошибка', errBadLogin: 'Неверные данные',
    urlBad: 'Допустима только ссылка YouTube или Vimeo.', dup: 'Это видео уже добавлено.', tooMany: 'В этой теме слишком много видео.', verifiedOnly: 'Добавлять видео могут только проверенные учителя.',
    noContacts: 'В названии не должно быть контактов.', typeNotAllowed: 'Этот тип файла не разрешён.', quota: 'Место закончилось.',
    dropHere: 'Отпустите здесь', subject: 'Предметы', all: 'Все', retryLoad: 'Загрузить снова', files: 'файл.',
  },
  en: {
    appName: 'School17 Teacher', server: 'Server', signIn: 'Sign in', phone: 'Phone', email: 'Email', password: 'Password',
    phoneHint: 'Your phone number (+998...)', sendCode: 'Send code', code: '6-digit code', codeSent: 'The code was sent through Telegram.',
    verify: 'Confirm', back: 'Back', needProfile: 'There is no account for this number. Register as a teacher in the phone app first.',
    teachersOnly: 'This program is for teachers only. Please use the phone app.',
    logout: 'Log out', myClasses: 'My classes', noClasses: 'No classes yet. Create a class in the phone app.',
    topicVideos: 'Topic videos', topicVideosSub: 'YouTube / Vimeo links', pupils: 'pupils',
    dropTitle: 'Drop videos here', dropSub: 'or click to choose', alsoPost: 'Tell the class in the chat', newVideo: 'New video',
    uploading: 'Uploading', done: 'Done', failed: 'Failed', retry: 'Retry', cancel: 'Cancel', cancelled: 'Cancelled',
    videos: 'Videos', noVideos: 'No videos yet. Drop the first one above.', play: 'Watch', remove: 'Delete',
    allowDl: 'Allow download', confirmRemove: 'Delete this video?', preparing: 'Preparing...',
    search: 'Search', noTopics: 'No topics found.', addVideo: 'Add a video', url: 'Link (YouTube or Vimeo)', vTitle: 'Title', vLang: 'Language',
    save: 'Save', saved: 'Added', mine: 'Mine', open: 'Open', close: 'Close', loading: 'Loading...', reload: 'Refresh',
    errNetwork: 'Cannot reach the internet or the server. Wait a moment for the server to wake up and try again.',
    errTimeout: 'The server did not answer. Try again.', errGeneric: 'Something went wrong', errBadLogin: 'Wrong details',
    urlBad: 'Only a YouTube or Vimeo link is allowed.', dup: 'This video is already added.', tooMany: 'This topic has too many videos.', verifiedOnly: 'Only verified teachers can add videos.',
    noContacts: 'The title must not contain contact details.', typeNotAllowed: 'This file type is not allowed.', quota: 'Storage is full.',
    dropHere: 'Release to add', subject: 'Subjects', all: 'All', retryLoad: 'Reload', files: 'files',
  },
};
let LANG = 'uz';
function setLang(l) { if (STRINGS[l]) LANG = l; }
function t(k, v) {
  let s = (STRINGS[LANG] && STRINGS[LANG][k]) || STRINGS.en[k] || k;
  if (v) for (const x in v) s = s.replace('{' + x + '}', v[x]);
  return s;
}
