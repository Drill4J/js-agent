import { app } from './app';
import { SERVER_PORT } from './constants';

export const server = app.listen(SERVER_PORT, () => {
  console.log(
    '  App is running at http://localhost:%d in %s mode',
    SERVER_PORT,
    app.get('env')
  );
  console.log('  Press CTRL-C to stop\n');
});
