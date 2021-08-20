from dotenv import load_dotenv

from clean import Clean

load_dotenv()


def run_app(name):
    print(f'Hi, {name}')  # Press ⌘F8 to toggle the breakpoint.


if __name__ == '__main__':
    run_app('PyCharm')

