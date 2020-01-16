import { server } from '../src';

export function stopServer() {
  beforeEach(() => {
    return server.close(() => console.log('Http server closed.'));
  });
}
