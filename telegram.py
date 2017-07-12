import re

from time import sleep, time

from getpass import getpass

from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.tl.types import (
    UpdateNewChannelMessage,
    InputPeerEmpty
)
from telethon.tl.functions.messages import (
    GetDialogsRequest,
    GetHistoryRequest
)
from telethon.tl.functions.help import GetConfigRequest
from telethon.utils import (
    find_user_or_chat,
    get_input_peer
)


def sprint(string, *args, **kwargs):
    """Safe Print (handle UnicodeEncodeErrors on some terminals)"""
    try:
        print(string, *args, **kwargs)
    except UnicodeEncodeError:
        string = string.encode('utf-8', errors='ignore')\
                       .decode('ascii', errors='ignore')
        print(string, *args, **kwargs)


def print_title(title):
    # Clear previous window
    print('\n')
    print('=={}=='.format('=' * len(title)))
    sprint('= {} ='.format(title))
    print('=={}=='.format('=' * len(title)))


class TelegramChannelLatestMessageClient(TelegramClient):
    # Constructor
    def __init__(
        self,
        session_user_id,
        user_phone,
        api_id,
        api_hash,
        proxy=None
    ):
        print('Initialization')
        super().__init__(session_user_id, api_id, api_hash, proxy)

        # Store all the found media in memory here,
        # so it can be downloaded if the user wants
        self.found_media = set()

        print('Connecting to Telegram servers...')
        if not self.connect():
            print('Initial connection failed. Retrying...')
            if not self.connect():
                print('Could not connect to Telegram servers.')
                return

        # Then, ensure we're authorized and have access
        if not self.is_user_authorized():
            print('First run. Sending code request...')
            self.send_code_request(user_phone)

            self_user = None
            while self_user is None:
                code = input('Enter the code you just received: ')
                try:
                    self_user = self.sign_in(user_phone, code)

                # Two-step verification may be enabled
                except SessionPasswordNeededError:
                    pw = getpass('Two step verification is enabled. '
                                 'Please enter your password: ')

                    self_user = self.sign_in(password=pw)
        print("Connected successfully")

    # Get config for current session
    def getConfig(self):
        result = self.invoke(GetConfigRequest())
        dcOptions = result.dc_options
        for dcOption in dcOptions:
            print('Option', 'Id', dcOption.id, 'Address', dcOption.ip_address)

    # Get latest message
    def getLatestMessageFromMessageHistory(self, channel):
        result = self.invoke(
            GetHistoryRequest(
                get_input_peer(channel),
                limit=1,
                offset_date=None,
                offset_id=0,
                max_id=0,
                min_id=0,
                add_offset=0
            )
        )
        return result.messages[0]

    # Get list of dialogs for user
    def getDialogs(
        self,
        limit=10,
        offset_date=None,
        offset_id=0,
        offset_peer=InputPeerEmpty()
    ):
        result = self.invoke(
            GetDialogsRequest(
                offset_date=None,
                offset_id=0,
                offset_peer=InputPeerEmpty(),
                limit=10
            )
        )
        return (
            r.dialogs,
            [find_user_or_chat(d.peer, result.users, result.chats)
             for d in result.dialogs]
        )

    def listenForUpdate(self):
        # Listen for updates
        self.add_update_handler(self.update_handler)
        while True:
            continue

    def trackLatestMessage(self):
        # Fetch Dialogs
        dialogs, entities = self.get_dialogs(5)
        for entity in entities:
            if entity.username == 'PumpNotifier':
                pumpChannel = entity
            # if entity.username == 'teehee94':
            #     pumpChannel = entity

        messageId = -1
        pattern = re.compile(
            r"https://bittrex.com/Market/Index\?MarketName=BTC-(\w+)"
        )
        while True:
            message = self.getLatestMessageFromMessageHistory(pumpChannel)
            if messageId != message.id:
                messageId = message.id
                content = message.message
                match = pattern.search(content)
                print('New Message\n', content)
                if match is not None:
                    currency = match.group(1)
                    print_title(currency)
            sleep(1)

    @staticmethod
    def update_handler(update_object):
        if hasattr(update_object, "updates"):
            if type(update_object.updates[0]) is UpdateNewChannelMessage:
                print('\nMessage\n', update_object.updates[0].message.message)


USER_PHONE = '+6583496137'
API_ID = '170060'
API_HASH = 'b33c2337f604dd0bcfe1be3df6b41f3a'
client = TelegramChannelLatestMessageClient(
    'session_id', USER_PHONE, API_ID, API_HASH
)
client.getConfig()
