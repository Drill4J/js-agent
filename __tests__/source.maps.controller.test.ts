import request from "supertest";
import { app, server } from '../src/index'

beforeEach(async () => {
    await server.close();
});

test('should test status controller', async () => {
    const data = { 
        version: 3,
        file: "test.js"
    }  
    
    
    const res = await request(app.app)
      .post('/source-maps')
      .send(data);

      expect(res.status).toEqual(200)
      expect(res.body).toEqual({"status": "saved"})
})