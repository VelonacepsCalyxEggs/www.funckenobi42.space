import os
import sys
from pydub import AudioSegment
from pydub.playback import _play_with_simpleaudio
from pydub import effects
from mutagen.mp3 import MP3
import json
import random
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from datetime import datetime, timezone
import socket
import threading
import configus
import configus2


global playback_obj

HOST = '' 
PORT = 55062 # choose a port number greater than 1024
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM) # create a TCP socket
s.bind((HOST, PORT)) # bind the socket to the port
s.listen(1) # listen for incoming connections
# Thread to handle each "client_soc" connection

def handler(client_soc, client_address):
     try:
          while True:
               global playback_obj
               print('Connected by', client_address) # print the address of the client
               dataRequest = client_soc.recv(1024) # receive up to 1 KB of data
               result = dataRequest.decode('UTF-8')
               result = str(result).split()
               try:
                    conn = psycopg2.connect(**configus.db_config)
                    print("Connection successful!")
               except psycopg2.Error as e:
                    print(f"Error connecting to the database: {e}")
                    return
               cur = conn.cursor()
               try:
                    query1 = f"SELECT * FROM users WHERE username = '{result[0]}' AND password = '{result[1]}'"
                    cur.execute(query1)
               except Exception as e:
                    print(e)
               conn.commit()
               try:
                    db = cur.fetchall()
                    if len(db) != 0:
                         print(db)
                         print(result)
                         if result[2] == 'skip':
                              response = 'skipped...'
                              client_soc.send(response.encode())
                              playback_obj.stop()
                         else: 
                              print('ligma balls')
                              response = '42'
                              client_soc.send(response.encode())
                    else:
                         1
               except Exception as e:
                    response = 'fuck you'
                    print(e)
                    client_soc.send(response.encode())
               break
          
          conn.close()
          client_soc.close() # close the connection
          print(f"Connection {client_address} was closed succsessfully.")
     except ConnectionResetError:
          print(f'Connection {client_address} closed on clientside.')
def acceptor():
      while True:
               try:
                    client_soc, client_address = s.accept()
                    # Send each "client_soc" connection as a parameter to a thread.
                    t = threading.Thread(target=handler, args=(client_soc, client_address), daemon=True)
                    t.start()
               except BlockingIOError: # No connection is available
                    pass # Do nothing and continue the loop
t = threading.Thread(target=acceptor, args=(), daemon=True)
t.start()
#this function writes data to SQL for my experiment             

def writeDataToSQL(songName, songArtist, songAlbum, when_started, duration, id):
    conn = psycopg2.connect(**configus2.db_config)
    print("Connection successful!")
    cur = conn.cursor()
    query1 = """
    INSERT INTO music_sync (name, author, album, duration, when_started, id) 
    VALUES (%s, %s, %s, %s, %s, %s)
    """

    
    cur.execute(query1, (str(songName), str(songArtist), str(songAlbum), float(duration), when_started, id))
    conn.commit()
    cur.close()
    conn.close()
    return



# this function is responsible for playing the music.
def Player():
     try:
          conn = psycopg2.connect(**configus2.db_config)
          print("Connection successful!")
     except psycopg2.Error as e:
          print(f"Error connecting to the database: {e}")
          return
     cur = conn.cursor()
     cur.execute('SELECT max(id) FROM music')
     maxQueueNumber = cur.fetchall()[0][0]
     print(maxQueueNumber)
     queueNumber = random.randint(1, maxQueueNumber) # generate a random queue number to choose the music
     # defining the custom playlist file
     AuthorNamesArr = ["Ryan Gosling", "Arnold Schwarzenegger", "Joe Biden", "Witness from Fryazino", "Zhenya Prigozhin", "Baskov", "Alec R.", "Ivan Chuvaev", "Father Grigori", "ligma", "Johann Sebastian Bach", "Karl","Jean-Luc Picard", "Gene Roddenberry", "Michael Bay", "John Cena", "Kim Jong Un", "Mao Zedong", "Winnie-the-Pooh", "The Bomb Bay", "The Broadway","Your mom", "Da ne umer on v konce Drive!", "Michael Jackson", "Robert Downey Jr", "Winston Churchill", "Steven Hawking", "Mozart"]
     dayNumber = datetime.now()
     cur.execute('SELECT * FROM music')
     filtered_list = cur.fetchall()
     global playback_obj # THANK YOU BLYA
     while queueNumber != -1: # this while loop is responsible for changing tracks upon end.
          print(dayNumber)
          dayNumber = datetime.now()
          cur.execute('SELECT * FROM playlist')
          playlist = cur.fetchall()
          if len(playlist) == 0: # first it checks whether the size of customplaylist file is equal to 2 bytes, if so, it's empty, and we play a random song
               missingName = random.choice(AuthorNamesArr)
               random_song = random.choice(filtered_list)
               activeSong = random_song[8] # we get the path to the song
               sound = AudioSegment.from_mp3(activeSong.replace("\\", "/")) # get the audio segment from the active song
               timeleft = sound.duration_seconds
               whenstarted = datetime.now()
               audio = MP3(activeSong) # for metadata 
               songName = audio.get("TIT2", 'ligma')
               songArtist = audio.get("TPE1", missingName)
               songAlbum = audio.get("TALB", 'gigaballs')
               writeDataToSQL(songAlbum, songArtist, songName, whenstarted, timeleft, random_song[0])
               timeleft = int(sound.duration_seconds)
               print(timeleft)
               host = "localhost"
               port = 55063

               # Create a socket object
               s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

               # Connect to the server
               s.connect((host, port))

               # Send a message
               message = random_song[0]
               s.sendall(str(message).encode())

               # Close the socket
               s.close()
               from pydub import effects

               # Normalize the audio to a target dBFS (decibels relative to full scale)
               normalized_sound = effects.normalize(sound)

               # Export the normalized audio
               playback_obj = _play_with_simpleaudio(normalized_sound) #I AM GOING TO HANG MYSELF ON MY FUCKING HEADPHONE WIRES.
               while playback_obj.is_playing():
                    1 
          else:
               print('Custom playlist initialized')
               for song in playlist:
                    missingName = random.choice(AuthorNamesArr)
                    print(song[1])
                    cur.execute('SELECT * FROM music WHERE id = %s', (str(song[1]),))
                    currentSong = cur.fetchone()
                    activeSong = currentSong[8] # we get the path to the song
                    sound = AudioSegment.from_mp3(activeSong.replace("\\", "/")) # get the audio segment from the active song
                    timeleft = sound.duration_seconds
                    whenstarted = datetime.now()
                    audio = MP3(activeSong) # for metadata 
                    songName = audio.get("TIT2", 'ligma')
                    songArtist = audio.get("TPE1", missingName)
                    songAlbum = audio.get("TALB", 'gigaballs')
                    writeDataToSQL(songName, songArtist, songAlbum, whenstarted, timeleft, currentSong[0])
                    timeleft = int(sound.duration_seconds)
                    print(timeleft)
                    host = "localhost"
                    port = 55063

                    # Create a socket object
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

                    # Connect to the server
                    s.connect((host, port))

                    # Send a message
                    message = currentSong[0]
                    s.sendall(str(message).encode())

                    # Close the socket
                    s.close()
                    from pydub import effects

                    # Normalize the audio to a target dBFS (decibels relative to full scale)
                    normalized_sound = effects.normalize(sound)

                    # Export the normalized audio
                    print(f'Currently playing: {currentSong} from custom playlist with data: {song}' )
                    playback_obj = _play_with_simpleaudio(normalized_sound) #I AM GOING TO HANG MYSELF ON MY FUCKING HEADPHONE WIRES.
                    while playback_obj.is_playing():
                         1 
                    cur.execute('DELETE FROM playlist WHERE song_id = %s ;', (str(song[1]),))
                    conn.commit()

     # once the custom playlist is clear, we choose another random song.
          queueNumber = random.randint(1, maxQueueNumber)   
     # rinse and repeat
     return(1)

# make an integration with node.js API for my website, almost done! 
# le make a good system for turning off the script when it's a new day.