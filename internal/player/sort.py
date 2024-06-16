import os
from mutagen.mp3 import MP3
import json
from jinja2 import Template
import hashlib
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import configus2

def calculate_md5_large(file_path):
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def collectInitialData():
    try:
        conn = psycopg2.connect(**configus2.db_config)
        print("Connection successful!")
    except psycopg2.Error as e:
        print(f"Error connecting to the database: {e}")
        return
    cur = conn.cursor()

    # Fetch all MD5 values from the database and store them in a set for quick lookup
    cur.execute('SELECT md5 FROM music')
    existing_md5s = {md5[0] for md5 in cur.fetchall()}

    check = 0
    while(check == 0):
        userInput = input("Do you want to scan the music folder? Y/N? ")
        if userInput == "Y":
            check = 1
            path = "F:\\Share\\Music\\" # directory where all music is located
            queueNumber = 0
            for root, dirs, files in os.walk(path):
                for file in files:
                    ext = os.path.splitext(file)[1]
                    if ext == ".mp3":
                        file_path = os.path.join(root, file)   
                        audio = MP3(file_path)
                        queueNumber += 1
                        print("Queue Number: " + str(queueNumber))
                        songName = audio.get("TIT2", 'Unknown Title')
                        songArtist = audio.get("TPE1", 'Unknown Artist')
                        songAlbum = audio.get("TALB", 'Unknown Album')
                        songGenre = audio.get("TCON", 'Unknown Genre')
                        albumCover = "/images/covers/" + str(songAlbum).translate(str.maketrans('', '', ':/*?"<> .\'')) + "Cover.jpg"

                        md5_value = calculate_md5_large(file_path)
                        
                        # Check if the song's MD5 hash is in the set of existing MD5 hashes
                        if md5_value not in existing_md5s:
                            try:
                                cur.execute('INSERT INTO music (name, author, album, genre, path_to_cover, md5, local) VALUES (%s, %s, %s, %s, %s, %s, %s)', (str(songName), str(songArtist), str(songAlbum), str(songGenre), str(albumCover), md5_value, file_path))
                                conn.commit()
                                # Add the new MD5 hash to the set
                                existing_md5s.add(md5_value)
                            except Exception as e:
                                print(f'An error occurred! \n {e}')
                                conn.rollback()
                        else:
                            print("Song already exists in the database:", file)
                    else:
                        print("Unsupported file format:", file) 
            
            print("Tracks in the folder: ", queueNumber)
        elif userInput == "N":
            print("Proceeding to next stage.")
            check = 1
        else:
            print("Please enter a valid answer...")
    cur.close()
    conn.close()
    return





        




 







