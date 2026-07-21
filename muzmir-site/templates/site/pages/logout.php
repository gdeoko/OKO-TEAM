<?php
/** Выход из аккаунта. */
logout_user();
flash('Вы вышли из аккаунта.', 'info');
redirect('/');
