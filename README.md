# Medical-Chatbot-GenAI


# How to run?
### STEPS:

Clone the repository

```terminal
Project repo: https://github.com/
```
### STEP 01- Install and create a python virtual environment after opening the repository

```terminal
pip install virtualenv
python -m virtualenv my_project_env
```

```terminal
.\my_project_env\Scripts\activate
```


### STEP 02- install the requirements
```terminal
pip install -r requirements.txt
```


### Create a `.env` file in the root directory and add your Pinecone & openai credentials as follows:

```ini
PINECONE_API_KEY = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
GROQ_API_KEY = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```


```terminal
# run the following command to store embeddings to pinecone
python store_index.py
```

```terminal
# Finally run the following command
python app.py
```

Now,
```terminal
open up localhost:
```


### Techstack Used:

- Python
- LangChain
- Flask
- Llama-3.3
- Pinecone
