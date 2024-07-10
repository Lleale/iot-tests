import os
import sys
from flask import Flask, request

dir = os.path.abspath('tesseract_server.bin').replace(os.path.basename('tesseract_server.bin'), '')
dir_tesseract = sys.argv[1]

def captcha_solver(id, host_iot):
    os.system(f'curl -k -o {dir}{id}.png --request GET https://{host_iot}/api/v1/captcha/download?id={id}')
    answer = os.popen(f'cd {dir_tesseract} | tesseract "{dir}{id}.png" - --psm 8 -l eas3_cap').read()
    print(f'answer = {answer}')
    os.system(f'rm {dir}/{id}.png')
    return answer

app = Flask(__name__)
@app.route('/captcha', methods=['POST'])
def captcha():
    data = request.get_json()
    print(f'id = {data["id"]}, host = {data["host"]}')
    answer = captcha_solver(data['id'], data['host'])
    answer = {"answer": answer.split('\n')[0]}
    return answer

if __name__ == '__main__':
    app.run(host=sys.argv[2],port=5109)
