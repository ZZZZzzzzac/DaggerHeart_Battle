import json
import uuid
import sys
import os

def add_uuid_to_json(file_path):
    # 检查文件是否存在
    if not os.path.exists(file_path):
        print(f"错误: 文件 '{file_path}' 不存在。")
        return

    # 读取 JSON 文件
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"JSON 解析错误: {e}")
        return
    except Exception as e:
        print(f"读取文件时出错: {e}")
        return

    # 确保根元素是列表
    if not isinstance(data, list):
        print("错误: JSON 文件的根元素必须是一个数组 (list)。")
        return

    modified_count = 0
    # 遍历数组
    for item in data:
        # 确保是字典对象且没有 id 字段
        if isinstance(item, dict) and 'id' not in item:
            item['id'] = str(uuid.uuid4())
            modified_count += 1

    # 如果有修改，则写回文件
    if modified_count > 0:
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            print(f"成功处理文件: {file_path}")
            print(f"共为 {modified_count} 个对象添加了 UUID。")
        except Exception as e:
            print(f"写入文件时出错: {e}")
    else:
        print(f"文件 '{file_path}' 中所有对象均已有 ID，未做任何修改。")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python add_uuid.py <json文件路径>")
        print("例如: python add_uuid.py data/test.json")
    else:
        # 处理命令行传入的每一个文件路径
        for file_path in sys.argv[1:]:
            print(f"正在处理: {file_path} ...")
            add_uuid_to_json(file_path)
            print("-" * 30)
